import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { Inject, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import type { LlmConnectionConfig } from "../ai/llm-config.types"
import { AuthModule } from "../auth/auth.module"
import { UserCloudAiService } from "../auth/user-cloud-ai.service"
import { DocumentsModule } from "../documents/documents.module"
import { CosModule } from "../storage/cos.module"
import { CosService } from "../storage/cos.service"
import { embedKnowledgeTexts } from "./embedding-client"
import { KnowledgeIngestWorker } from "./knowledge-ingest.worker"
import { KnowledgeLibraryRepository } from "./knowledge-library.repository"
import { KnowledgeLibraryService } from "./knowledge-library.service"
import { KnowledgeController } from "./knowledge.controller"
import {
  KnowledgeQaService,
  type KnowledgeStreamChat,
} from "./knowledge-qa.service"
import { KnowledgeSourceRepository } from "./knowledge-source.repository"
import {
  KNOWLEDGE_PUT_FILE,
  KnowledgeSourceService,
  type KnowledgePutFile,
} from "./knowledge-source.service"

const INGEST_INTERVAL_MS = 2000

const streamKnowledgeChat: KnowledgeStreamChat = async function* (input) {
  const llm = input.llm as LlmConnectionConfig | undefined
  if (!llm?.apiKey || !llm.model) {
    return
  }
  const model = new ChatOpenAI({
    apiKey: llm.apiKey,
    model: llm.model,
    configuration: { baseURL: llm.baseUrl },
    streaming: true,
    timeout: 180_000,
    maxRetries: 0,
  })
  const messages = [
    new SystemMessage(input.system),
    ...input.messages.map((message) =>
      message.role === "user"
        ? new HumanMessage(message.content)
        : new SystemMessage(message.content)
    ),
  ]
  const stream = await model.stream(messages)
  for await (const chunk of stream) {
    const content = typeof chunk.content === "string" ? chunk.content : ""
    if (content) {
      yield content
    }
  }
}

@Module({
  imports: [DocumentsModule, AuthModule, CosModule],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeLibraryRepository,
    KnowledgeLibraryService,
    KnowledgeSourceRepository,
    {
      provide: KNOWLEDGE_PUT_FILE,
      useFactory: (cos: CosService): KnowledgePutFile => {
        return async (storageKey, bytes) => {
          await cos.putObject({
            objectKey: storageKey,
            body: bytes,
            contentType: "application/octet-stream",
          })
        }
      },
      inject: [CosService],
    },
    KnowledgeSourceService,
    {
      provide: KnowledgeQaService,
      useFactory: (
        libraries: KnowledgeLibraryService,
        sources: KnowledgeSourceRepository,
        userCloudAi: UserCloudAiService
      ) =>
        new KnowledgeQaService(libraries, sources, {
          embedTexts: (config, texts) =>
            embedKnowledgeTexts(config, texts, fetch),
          streamChat: streamKnowledgeChat,
          requireLlmConfig: (userId) => userCloudAi.requireLlmConfig(userId),
        }),
      inject: [
        KnowledgeLibraryService,
        KnowledgeSourceRepository,
        UserCloudAiService,
      ],
    },
    {
      provide: KnowledgeIngestWorker,
      useFactory: (sources: KnowledgeSourceRepository, cos: CosService) =>
        new KnowledgeIngestWorker(sources, {
          embedTexts: (config, texts) =>
            embedKnowledgeTexts(config, texts, fetch),
          getFile: (storageKey) => cos.getObject(storageKey),
        }),
      inject: [KnowledgeSourceRepository, CosService],
    },
  ],
})
export class KnowledgeModule implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(
    @Inject(KnowledgeIngestWorker)
    private readonly worker: KnowledgeIngestWorker
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.worker.processNext().catch(() => undefined)
    }, INGEST_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
    }
  }
}

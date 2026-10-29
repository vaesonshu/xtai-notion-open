import { BadRequestException, Injectable } from "@nestjs/common"
import type { EmbeddingConfig } from "./embedding-client"
import { KnowledgeLibraryService } from "./knowledge-library.service"
import {
  KNOWLEDGE_QA_SYSTEM_PROMPT,
  NO_HIT_ANSWER,
  buildKnowledgePrompt,
  selectKnowledgeHits,
  type KnowledgeCitation,
} from "./knowledge-retrieval"
import type { KnowledgeRetrievalStore } from "./knowledge-source.repository"
import {
  DEFAULT_EMBEDDING_BASE_URL,
  type EmbeddingSettings,
} from "./knowledge.types"

const QA_MAX_MESSAGES = 20
const QA_MAX_MESSAGE_CHARS = 8000
const MISSING_EMBEDDING = "请先配置资料库的嵌入模型"
const QA_LIMIT = "AI 请求内容超出限制"

export type KnowledgeChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type KnowledgeRetrieveResult = {
  citations: KnowledgeCitation[]
  pendingSourceCount: number
}

export type KnowledgeQaEvent =
  | {
      type: "citations"
      citations: KnowledgeCitation[]
      pendingSourceCount: number
    }
  | { type: "token"; content: string }
  | { type: "done" }

export type KnowledgeStreamChat = (input: {
  system: string
  messages: { role: string; content: string }[]
  llm?: unknown
}) => AsyncIterable<string>

export type KnowledgeQaDeps = {
  embedTexts: (config: EmbeddingConfig, texts: string[]) => Promise<number[][]>
  streamChat: KnowledgeStreamChat
  requireLlmConfig: (userId: string) => Promise<unknown>
}

function embeddingConfigFrom(settings: EmbeddingSettings): EmbeddingConfig {
  const apiKey = settings.openAiApiKey?.trim() ?? ""
  const model = settings.openAiEmbeddingModel?.trim() ?? ""
  if (!apiKey || !model) {
    throw new BadRequestException(MISSING_EMBEDDING)
  }
  return {
    apiKey,
    baseUrl: settings.openAiBaseUrl?.trim() || DEFAULT_EMBEDDING_BASE_URL,
    model,
  }
}

function assertQuestion(text: string): void {
  if (!text.trim() || text.length > QA_MAX_MESSAGE_CHARS) {
    throw new BadRequestException(QA_LIMIT)
  }
}

function assertMessages(messages: KnowledgeChatMessage[]): void {
  const last = messages[messages.length - 1]
  if (
    messages.length === 0 ||
    messages.length > QA_MAX_MESSAGES ||
    messages.some((message) => message.content.length > QA_MAX_MESSAGE_CHARS) ||
    last?.role !== "user" ||
    !last.content.trim()
  ) {
    throw new BadRequestException(QA_LIMIT)
  }
}

@Injectable()
export class KnowledgeQaService {
  constructor(
    private readonly libraries: Pick<KnowledgeLibraryService, "requireRole">,
    private readonly sources: KnowledgeRetrievalStore,
    private readonly deps: KnowledgeQaDeps
  ) {}

  async retrieve(
    userId: string,
    libraryId: string,
    query: string
  ): Promise<KnowledgeRetrieveResult> {
    const membership = await this.requireMemberAndEmbedding(userId, libraryId)
    assertQuestion(query)
    return this.search(
      membership.embeddingRevision,
      libraryId,
      query,
      embeddingConfigFrom(membership.embeddingSettings)
    )
  }

  async *answer(
    userId: string,
    libraryId: string,
    messages: KnowledgeChatMessage[]
  ): AsyncIterable<KnowledgeQaEvent> {
    const membership = await this.requireMemberAndEmbedding(userId, libraryId)
    // streamChat 拿不到 userId，把校验得到的 llm 传下去以免改用环境密钥。
    const llm = await this.deps.requireLlmConfig(userId)
    assertMessages(messages)
    const question = messages[messages.length - 1]?.content ?? ""
    const retrieved = await this.search(
      membership.embeddingRevision,
      libraryId,
      question,
      embeddingConfigFrom(membership.embeddingSettings)
    )
    yield {
      type: "citations",
      citations: retrieved.citations,
      pendingSourceCount: retrieved.pendingSourceCount,
    }
    if (retrieved.citations.length === 0) {
      // 没有达到相似度的片段时调用模型只会编造，因此跳过聊天模型、直接返回固定句。
      yield { type: "token", content: NO_HIT_ANSWER }
      yield { type: "done" }
      return
    }
    const context = buildKnowledgePrompt(retrieved.citations)
    for await (const content of this.deps.streamChat({
      system: KNOWLEDGE_QA_SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }, ...messages],
      llm,
    })) {
      yield { type: "token", content }
    }
    yield { type: "done" }
  }

  private async requireMemberAndEmbedding(userId: string, libraryId: string) {
    const membership = await this.libraries.requireRole(
      userId,
      libraryId,
      "viewer"
    )
    embeddingConfigFrom(membership.embeddingSettings)
    return membership
  }

  private async search(
    embeddingRevision: number,
    libraryId: string,
    query: string,
    config: EmbeddingConfig
  ): Promise<KnowledgeRetrieveResult> {
    // 只嵌入最新问题：历史只给生成模型，避免把追问改写成另一句检索词。
    const embedPromise = this.deps.embedTexts(config, [query])
    const pendingPromise = this.sources.countPendingSources(
      libraryId,
      embeddingRevision
    )
    const [vectors, pendingSourceCount] = await Promise.all([
      embedPromise,
      pendingPromise,
    ])
    const embedding = vectors[0]
    if (!embedding) {
      return { citations: [], pendingSourceCount }
    }
    const rows = await this.sources.findNearestChunks({
      libraryId,
      embeddingRevision,
      embedding,
    })
    return {
      citations: selectKnowledgeHits(
        rows.map((row) => ({ ...row, libraryRevision: embeddingRevision })),
        libraryId
      ),
      pendingSourceCount,
    }
  }
}

import { BadRequestException, Injectable } from "@nestjs/common"
import { DocumentsService } from "../documents/documents.service"
import { AiAgent } from "./ai.agent"
import type { AiChatRequest, AiStreamEvent } from "./ai.types"

export const AI_LIMITS = {
  documentText: 100_000,
  messages: 40,
  message: 10_000,
}

@Injectable()
export class AiService {
  constructor(
    private readonly documents: DocumentsService,
    private readonly agent: AiAgent
  ) {}

  async *chat(
    request: AiChatRequest,
    userId: string,
    signal?: AbortSignal
  ): AsyncIterable<AiStreamEvent> {
    if (!request || !Array.isArray(request.messages)) {
      throw new BadRequestException("AI 请求格式无效")
    }
    await this.documents.assertCanRead(request.documentId, userId)
    if (!request.documentId.trim() || !request.documentText.trim()) {
      throw new BadRequestException("文档和文档内容不能为空")
    }
    if (
      typeof request.documentText !== "string" ||
      request.documentText.length > AI_LIMITS.documentText ||
      request.messages.length > AI_LIMITS.messages ||
      request.messages.some(
        (message) =>
          (message.role !== "user" && message.role !== "assistant") ||
          !message.content.trim() ||
          message.content.length > AI_LIMITS.message
      )
    ) {
      throw new BadRequestException("AI 请求内容超出限制")
    }

    try {
      for await (const content of this.agent.stream({ ...request, signal })) {
        yield { type: "token", content }
      }
      if (!signal?.aborted) yield { type: "done" }
    } catch (error) {
      if (signal?.aborted) return
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "AI 服务暂不可用",
      }
    }
  }
}

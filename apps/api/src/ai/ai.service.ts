import { BadRequestException, Inject, Injectable } from "@nestjs/common"
import { DocumentsService } from "../documents/documents.service"
import { AiAgent } from "./ai.agent"
import { AiWriteAgent } from "./ai-write.agent"
import { partialArgsHaveNonEmptyText } from "@xtai-notion/editor-core/server"
import {
  AI_LIMITS,
  type AiChatRequest,
  type AiStreamEvent,
  type AiWriteRequest,
  type AiWriteStreamEvent,
  isAiChatMessage,
  isAiWriteRequest,
} from "./ai.types"

@Injectable()
export class AiService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(AiAgent) private readonly agent: AiAgent,
    @Inject(AiWriteAgent) private readonly writeAgent: AiWriteAgent
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
          !isAiChatMessage(message) ||
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

  async *write(
    request: AiWriteRequest,
    userId: string,
    signal?: AbortSignal
  ): AsyncIterable<AiWriteStreamEvent> {
    if (!isAiWriteRequest(request)) {
      throw new BadRequestException("AI 请求格式无效")
    }
    await this.documents.assertCanRead(request.documentId, userId)
    if (!request.documentId.trim() || !request.prompt.trim()) {
      throw new BadRequestException("文档和写作指令不能为空")
    }
    const blocksJson = JSON.stringify(request.blocks)
    if (
      request.prompt.length > AI_LIMITS.prompt ||
      blocksJson.length > AI_LIMITS.blocksJson ||
      request.selectedIds.length > AI_LIMITS.selectedIds
    ) {
      throw new BadRequestException("AI 请求内容超出限制")
    }

    try {
      let hasToolCall = false
      let hasNonEmptyPartial = false
      for await (const event of this.writeAgent.stream(request, signal)) {
        if (event.type === "tool_partial") {
          // 仅有可展示文本的 partial 也视为成功流，避免打字机预览后误报无改动
          if (partialArgsHaveNonEmptyText(event.name, event.args)) {
            hasNonEmptyPartial = true
          }
          yield event
          continue
        }
        hasToolCall = true
        yield event
      }
      if (!signal?.aborted) {
        if (hasToolCall || hasNonEmptyPartial) yield { type: "done" }
        else yield { type: "error", message: "没有可应用的改动" }
      }
    } catch (error) {
      if (signal?.aborted) return
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "AI 服务暂不可用",
      }
    }
  }
}

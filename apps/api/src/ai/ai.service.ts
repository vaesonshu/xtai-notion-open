import { BadRequestException, Inject, Injectable } from "@nestjs/common"
import { UserCloudAiService } from "../auth/user-cloud-ai.service"
import { WorkspacesService } from "../workspaces/workspaces.service"
import { DocumentsService } from "../documents/documents.service"
import { AiAgent } from "./ai.agent"
import { ArticleAgent } from "./article.agent"
import { AiWriteAgent } from "./ai-write.agent"
import { partialArgsHaveNonEmptyText } from "@xtai-notion/editor-core/server"
import {
  AI_LIMITS,
  type AiChatRequest,
  type AiStreamEvent,
  type AiWriteRequest,
  type AiWriteStreamEvent,
  type ArticleRequest,
  type ArticleStreamEvent,
  isAiChatMessage,
  isAiWriteRequest,
  isArticleRequest,
} from "./ai.types"

@Injectable()
export class AiService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
    @Inject(UserCloudAiService) private readonly userCloudAi: UserCloudAiService,
    @Inject(AiAgent) private readonly agent: AiAgent,
    @Inject(AiWriteAgent) private readonly writeAgent: AiWriteAgent,
    @Inject(ArticleAgent) private readonly articleAgent: ArticleAgent
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
      const llm = await this.userCloudAi.requireLlmConfig(userId)
      for await (const content of this.agent.stream({
        ...request,
        signal,
        llm,
      })) {
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
      const llm = await this.userCloudAi.requireLlmConfig(userId)
      let hasToolCall = false
      let hasNonEmptyPartial = false
      for await (const event of this.writeAgent.stream(request, signal, llm)) {
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

  async *article(
    request: ArticleRequest,
    userId: string,
    signal?: AbortSignal
  ): AsyncIterable<ArticleStreamEvent> {
    if (!isArticleRequest(request)) {
      throw new BadRequestException("文章写作请求格式无效")
    }
    if (!request.workspaceId.trim() || !request.prompt.trim()) {
      throw new BadRequestException("知识库与写作指令不能为空")
    }
    if (request.prompt.length > AI_LIMITS.articlePrompt) {
      throw new BadRequestException("写作指令超出长度限制")
    }
    if (
      request.documentText &&
      request.documentText.length > AI_LIMITS.documentText
    ) {
      throw new BadRequestException("文档正文超出长度限制")
    }

    const workspace = await this.workspaces.getWorkspace(
      request.workspaceId,
      userId
    )
    if (workspace.role === "viewer") {
      throw new BadRequestException("查看者无法创建文章")
    }
    if (workspace.aiSettings.aiProvider === "local_codex") {
      throw new BadRequestException(
        "该知识库已启用本地 Codex，请通过本机 Codex Bridge 写作"
      )
    }

    try {
      const llm = await this.userCloudAi.requireLlmConfig(userId)
      for await (const content of this.articleAgent.stream({
        prompt: request.prompt,
        workspaceName: workspace.name,
        extraInstructions: workspace.aiSettings.localCodexPrompt,
        documentText: request.documentText,
        signal,
        llm,
      })) {
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

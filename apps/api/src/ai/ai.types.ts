import type { AiBlockView, AiWriteOp } from "@xtai-notion/editor-core/server"

/** 聊天与写作接口共用的请求体大小限制 */
export const AI_LIMITS = {
  documentText: 100_000,
  messages: 40,
  message: 10_000,
  prompt: 10_000,
  articlePrompt: 20_000,
  blocksJson: 100_000,
  selectedIds: 200,
}

export type AiChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type AiChatRequest = {
  documentId: string
  documentText: string
  messages: AiChatMessage[]
}

export type AiStreamEvent =
  | { type: "token"; content: string }
  | { type: "done" }
  | { type: "error"; message: string }

export function isAiChatMessage(value: unknown): value is AiChatMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Record<string, unknown>
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  )
}

export type AiWriteRequest = {
  documentId: string
  mode: "slash" | "selection"
  prompt: string
  cursorBlockId: string
  selectedIds: string[]
  blocks: AiBlockView[]
}

/** Agent 流式事件：打字机 partial 与带 toolIndex 的完整 tool_call */
export type AiWriteAgentEvent =
  | {
      type: "tool_partial"
      toolIndex: number
      name: "insert_blocks" | "update_block"
      args: Record<string, unknown>
    }
  | { type: "tool_call"; toolIndex: number; op: AiWriteOp }

export type AiWriteStreamEvent =
  | AiWriteAgentEvent
  | { type: "done" }
  | { type: "error"; message: string }

function isAiBlockView(value: unknown): value is AiBlockView {
  if (!value || typeof value !== "object") return false
  const block = value as Record<string, unknown>
  return (
    typeof block.id === "string" &&
    typeof block.type === "string" &&
    typeof block.text === "string" &&
    typeof block.writable === "boolean" &&
    Array.isArray(block.children) &&
    block.children.every(isAiBlockView)
  )
}

/** 校验 POST /ai/write 请求体结构 */
export type ArticleRequest = {
  workspaceId: string
  prompt: string
  title?: string
  /** 基于当前文档写作时附带正文快照 */
  documentText?: string
}

export type ArticleStreamEvent =
  | { type: "token"; content: string }
  | { type: "done" }
  | { type: "error"; message: string }

export function isArticleRequest(value: unknown): value is ArticleRequest {
  if (!value || typeof value !== "object") return false
  const request = value as Record<string, unknown>
  return (
    typeof request.workspaceId === "string" &&
    typeof request.prompt === "string" &&
    (request.documentText === undefined ||
      typeof request.documentText === "string")
  )
}

export function isAiWriteRequest(value: unknown): value is AiWriteRequest {
  if (!value || typeof value !== "object") return false
  const request = value as Record<string, unknown>
  return (
    typeof request.documentId === "string" &&
    (request.mode === "slash" || request.mode === "selection") &&
    typeof request.prompt === "string" &&
    typeof request.cursorBlockId === "string" &&
    Array.isArray(request.selectedIds) &&
    request.selectedIds.every((id) => typeof id === "string") &&
    Array.isArray(request.blocks) &&
    request.blocks.every(isAiBlockView)
  )
}

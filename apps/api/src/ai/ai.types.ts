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

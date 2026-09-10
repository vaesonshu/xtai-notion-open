import type { ArticleStreamEvent } from "./types.js"

/** Codex 线程条目里需要跳过、不参与展示的文本类型。 */
const SKIP_ITEM_TYPES = new Set(["user_message"])

export type CodexItemStreamState = {
  activeItemId: string | null
  activeItemText: string
  /** 最后一次 agent_message，供导入时与思考过程分离。 */
  lastAgentMessage: string
}

export const INITIAL_CODEX_ITEM_STREAM_STATE: CodexItemStreamState = {
  activeItemId: null,
  activeItemText: "",
  lastAgentMessage: "",
}

export function extractStreamableCodexItem(item: {
  id?: string
  type?: string
  text?: string
}): { id: string; type: string; text: string } | null {
  if (!item.type || SKIP_ITEM_TYPES.has(item.type)) return null
  if (typeof item.text !== "string" || !item.text) return null
  return {
    id: item.id ?? `${item.type}-message`,
    type: item.type,
    text: item.text,
  }
}

/**
 * 将 Codex item 更新映射为 token 流：新条目追加而非替换，保留完整思考过程。
 */
export function applyCodexItemUpdate(
  state: CodexItemStreamState,
  item: { id?: string; type?: string; text?: string }
): { state: CodexItemStreamState; events: ArticleStreamEvent[] } {
  const message = extractStreamableCodexItem(item)
  if (!message) return { state, events: [] }

  const events: ArticleStreamEvent[] = []
  let next: CodexItemStreamState = { ...state }

  if (next.activeItemId !== message.id) {
    if (next.activeItemId !== null) {
      events.push({ type: "token", content: "\n\n" })
    }
    next.activeItemId = message.id
    next.activeItemText = ""
  }

  if (message.text.length > next.activeItemText.length) {
    const delta = message.text.slice(next.activeItemText.length)
    next.activeItemText = message.text
    if (delta) events.push({ type: "token", content: delta })
  }

  if (message.type === "agent_message") {
    next.lastAgentMessage = message.text
  }

  return { state: next, events }
}

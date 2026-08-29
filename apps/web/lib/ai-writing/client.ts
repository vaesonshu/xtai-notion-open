import type { AiWriteOp } from "@xtai-notion/editor-core"

/** POST /ai/write 的 SSE 事件，与 apps/api 契约一致 */
export type AiWriteStreamEvent =
  | { type: "tool_call"; op: AiWriteOp }
  | { type: "done" }
  | { type: "error"; message: string }

function parseSsePayload(data: string): AiWriteStreamEvent | null {
  try {
    const payload = JSON.parse(data) as AiWriteStreamEvent
    if (
      payload.type === "tool_call" ||
      payload.type === "done" ||
      payload.type === "error"
    ) {
      return payload
    }
    return null
  } catch {
    return null
  }
}

/**
 * 解析 AI 写作 SSE 流，与 ai-assistant-panel 相同：按空行分帧，取 data: 行 JSON。
 */
export async function* readAiWriteSse(
  response: Response
): AsyncGenerator<AiWriteStreamEvent> {
  if (!response.body) {
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const next = await reader.read()
    if (next.done) {
      break
    }
    buffer += decoder.decode(next.value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "))
      if (!dataLine) {
        continue
      }
      const payload = parseSsePayload(dataLine.slice(6))
      if (payload) {
        yield payload
      }
    }
  }
}

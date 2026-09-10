import type { ArticleStreamEvent } from "./article-agent-types"

export const LOCAL_CODEX_BRIDGE_BASE =
  process.env.NEXT_PUBLIC_CODEX_BRIDGE_URL ?? "http://127.0.0.1:3847"

export type BridgeHealth = {
  ok: boolean
  workspaceCount?: number
}

async function* readArticleSse(
  response: Response
): AsyncGenerator<ArticleStreamEvent> {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const next = await reader.read()
    if (next.done) break
    buffer += decoder.decode(next.value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "))
      if (!dataLine) continue
      try {
        const payload = JSON.parse(dataLine.slice(6)) as ArticleStreamEvent
        if (
          payload.type === "token" ||
          payload.type === "replace" ||
          payload.type === "done" ||
          payload.type === "error"
        ) {
          yield payload
        }
      } catch {
        // 忽略无法解析的 SSE 帧
      }
    }
  }
}

/** 探测本机 Codex Bridge 是否在线（仅浏览器可访问 127.0.0.1）。 */
export async function fetchBridgeHealth(): Promise<BridgeHealth> {
  try {
    const response = await fetch(`${LOCAL_CODEX_BRIDGE_BASE}/health`, {
      method: "GET",
      cache: "no-store",
    })
    if (!response.ok) return { ok: false }
    return (await response.json()) as BridgeHealth
  } catch {
    return { ok: false }
  }
}

/** 保存或清空知识库的本机资料目录（空字符串表示清除配置）。 */
export async function saveBridgeWorkspaceRoot(
  workspaceId: string,
  localRoot: string
): Promise<void> {
  const response = await fetch(
    `${LOCAL_CODEX_BRIDGE_BASE}/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ localRoot }),
    }
  )
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "保存本地目录失败")
  }
}

export async function* streamLocalArticle(input: {
  workspaceId: string
  prompt: string
  title?: string
  workspaceName?: string
  extraInstructions?: string
  documentText?: string
  signal?: AbortSignal
}): AsyncGenerator<ArticleStreamEvent> {
  const response = await fetch(`${LOCAL_CODEX_BRIDGE_BASE}/article/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: input.signal,
  })
  if (!response.ok) {
    let message = "本地 Codex 请求失败"
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // 非 JSON 错误体
    }
    yield { type: "error", message }
    return
  }
  yield* readArticleSse(response)
}

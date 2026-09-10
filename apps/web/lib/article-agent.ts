import { apiRequest } from "@/lib/api-client"
import type {
  ArticleComposeRequest,
  ArticleStreamEvent,
  WorkspaceAiProvider,
} from "@/lib/article-agent-types"
import { isDesktopClient } from "@/lib/desktop-bridge"
import { fetchBridgeHealth, streamLocalArticle } from "@/lib/local-codex-bridge"

export const DOCUMENT_AGENT_DESKTOP_ONLY_MESSAGE =
  "目前仅支持桌面端，请使用 XtAi Notion 桌面客户端。"

async function* readCloudArticleSse(
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

export type ArticleAgentMode = "cloud" | "local_codex" | "unavailable"

/** 根据知识库配置与本机 Bridge 状态决定实际写作通道。 */
export async function resolveArticleAgentMode(
  aiProvider: ArticleComposeRequest["aiSettings"]["aiProvider"]
): Promise<ArticleAgentMode> {
  if (aiProvider === "cloud") return "cloud"
  const health = await fetchBridgeHealth()
  return health.ok ? "local_codex" : "unavailable"
}

/** 智能体仅在桌面端且本机 Codex Bridge 在线时可用。 */
export function isAgentAvailable(mode: ArticleAgentMode): boolean {
  return isDesktopClient() && mode === "local_codex"
}

/** 打开智能体前的统一校验（工具栏按钮、侧栏 Tab 共用）。 */
export async function ensureDocumentAgentAccess(input: {
  workspaceId?: string
  aiProvider?: WorkspaceAiProvider
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.workspaceId || !input.aiProvider) {
    return {
      ok: false,
      message: "当前文档未关联知识库，无法使用智能体。",
    }
  }
  if (!isDesktopClient()) {
    return { ok: false, message: DOCUMENT_AGENT_DESKTOP_ONLY_MESSAGE }
  }
  const mode = await resolveArticleAgentMode(input.aiProvider)
  if (!isAgentAvailable(mode)) {
    return {
      ok: false,
      message: getAgentUnavailableMessage(mode, input.aiProvider),
    }
  }
  return { ok: true }
}

/** 智能体不可用时的提示文案（用于 toast / 面板空态）。 */
export function getAgentUnavailableMessage(
  mode: ArticleAgentMode,
  aiProvider: WorkspaceAiProvider
): string {
  if (!isDesktopClient()) {
    return DOCUMENT_AGENT_DESKTOP_ONLY_MESSAGE
  }
  if (aiProvider === "cloud") {
    return "智能体需接入本地 Codex。请在个人中心 → AI 设置中切换为「本地 Codex」。"
  }
  if (mode === "unavailable") {
    return "未检测到 Codex Bridge。请先运行 pnpm dev:local 或 pnpm codex-bridge。"
  }
  return "智能体暂不可用，请检查 Codex 配置。"
}

export async function* streamArticle(
  input: ArticleComposeRequest & {
    userId: string
    signal?: AbortSignal
  }
): AsyncGenerator<ArticleStreamEvent> {
  if (!isDesktopClient()) {
    yield { type: "error", message: DOCUMENT_AGENT_DESKTOP_ONLY_MESSAGE }
    return
  }

  const mode = await resolveArticleAgentMode(input.aiSettings.aiProvider)

  if (mode === "unavailable") {
    yield {
      type: "error",
      message:
        "该知识库使用本地 Codex，但未检测到 Codex Bridge。请先运行 pnpm codex-bridge。",
    }
    return
  }

  if (mode === "local_codex") {
    yield* streamLocalArticle({
      workspaceId: input.workspaceId,
      prompt: input.prompt,
      title: input.title,
      workspaceName: input.workspaceName,
      extraInstructions: input.aiSettings.localCodexPrompt,
      documentText: input.documentText,
      signal: input.signal,
    })
    return
  }

  const response = await apiRequest({
    path: "/ai/article",
    method: "POST",
    userId: input.userId,
    json: {
      workspaceId: input.workspaceId,
      prompt: input.prompt,
      title: input.title,
      documentText: input.documentText,
    },
    signal: input.signal,
  })

  if (!response.ok) {
    yield {
      type: "error",
      message: await response.text(),
    }
    return
  }

  yield* readCloudArticleSse(response)
}

/** 从 Markdown 首行 # 标题提取文档名。 */
export function extractMarkdownTitle(
  markdown: string,
  fallback = "AI 文章"
): string {
  const line = markdown
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith("#"))
  if (!line) return fallback
  return line.replace(/^#+\s*/, "").trim() || fallback
}

import { mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import {
  INITIAL_CODEX_ITEM_STREAM_STATE,
  applyCodexItemUpdate,
  extractStreamableCodexItem,
} from "./codex-item-stream.js"
import type { ArticleRunRequest, ArticleStreamEvent } from "./types.js"

const DEFAULT_CODEX_WORKDIR = join(homedir(), ".inkspace", "codex-sandbox")

export type CodexRunner = {
  streamArticle(
    input: ArticleRunRequest & { localRoot?: string },
    signal?: AbortSignal
  ): AsyncIterable<ArticleStreamEvent>
}

/** 未配置资料目录时使用本机沙箱目录，保证 Codex SDK 有可写工作区。 */
async function resolveWorkingDirectory(localRoot?: string): Promise<string> {
  const dir = localRoot?.trim() || DEFAULT_CODEX_WORKDIR
  await mkdir(dir, { recursive: true })
  return dir
}

/** 将 Codex SDK 事件映射为 Inkspace 文章流事件。 */
export function createCodexRunner(): CodexRunner {
  return {
    async *streamArticle(input, signal) {
      let CodexSdk: typeof import("@openai/codex-sdk").Codex
      try {
        CodexSdk = (await import("@openai/codex-sdk")).Codex
      } catch {
        yield {
          type: "error",
          message:
            "未安装 @openai/codex-sdk 或 Codex CLI。请在本机安装 Codex 后重试。",
        }
        return
      }

      const documentContext = input.documentText?.trim()
      const configuredLocalRoot = input.localRoot?.trim()
      const workingDirectory =
        await resolveWorkingDirectory(configuredLocalRoot)

      const systemParts = [
        documentContext
          ? "你是文档协作写作智能体。结合用户提供的当前文档完成续写、润色、扩写等任务。只输出可直接粘贴的 Markdown 结果。"
          : configuredLocalRoot
            ? "你是知识库文章写作助手。可阅读本地资料目录中的相关文件，必要时使用联网能力补充信息。输出完整 Markdown：首行 # 标题，正文使用 ## / ### 小节。"
            : "你是知识库文章写作助手。根据用户指令与联网检索撰写内容；输出完整 Markdown：首行 # 标题，正文使用 ## / ### 小节。",
        "不要用 ```markdown 代码块包裹全文。",
        input.workspaceName ? `目标知识库：${input.workspaceName}` : null,
        input.extraInstructions?.trim() || null,
        configuredLocalRoot ? `本地资料根目录：${configuredLocalRoot}` : null,
      ].filter(Boolean)

      const userPrompt = documentContext
        ? [
            "【当前文档】",
            documentContext,
            "",
            "【写作任务】",
            input.prompt.trim(),
          ].join("\n")
        : [
            input.title?.trim() ? `建议标题：${input.title.trim()}` : null,
            input.prompt.trim(),
          ]
            .filter(Boolean)
            .join("\n\n")

      try {
        const codex = new CodexSdk()
        const thread = codex.startThread({
          workingDirectory,
          skipGitRepoCheck: true,
          sandboxMode: "workspace-write",
          webSearchEnabled: true,
        })

        const prompt = `${systemParts.join("\n\n")}\n\n---\n\n${userPrompt}`
        const { events } = await thread.runStreamed(prompt, { signal })
        let streamState = INITIAL_CODEX_ITEM_STREAM_STATE

        for await (const event of events) {
          if (signal?.aborted) return

          if (
            event.type === "item.updated" ||
            event.type === "item.completed"
          ) {
            if (!extractStreamableCodexItem(event.item)) continue
            const mapped = applyCodexItemUpdate(streamState, event.item)
            streamState = mapped.state
            for (const streamEvent of mapped.events) {
              yield streamEvent
            }
          }

          if (event.type === "turn.failed") {
            yield {
              type: "error",
              message: event.error.message || "本地 Codex 执行失败",
            }
            return
          }

          if (event.type === "error") {
            yield { type: "error", message: event.message }
            return
          }
        }

        if (!signal?.aborted) {
          yield {
            type: "done",
            article: streamState.lastAgentMessage.trim() || undefined,
          }
        }
      } catch (error) {
        if (signal?.aborted) return
        yield {
          type: "error",
          message:
            error instanceof Error ? error.message : "本地 Codex 执行失败",
        }
      }
    },
  }
}

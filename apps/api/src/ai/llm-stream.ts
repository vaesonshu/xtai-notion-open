import { Logger } from "@nestjs/common"
import type { NodeEnvironment } from "../config/environment"

const logger = new Logger("LlmStream")

/** 网络抖动、限流、网关错误时可重试 */
export function isRetryableLlmError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }
  const record = error as Record<string, unknown>
  const status = typeof record.status === "number" ? record.status : undefined
  if (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true
  }
  const code = typeof record.code === "string" ? record.code : ""
  if (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN"
  ) {
    return true
  }
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error)
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("socket hang up")
  )
}

export async function delayMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error("aborted"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/** 开发环境附带底层错误，便于排查代理/模型配置 */
export function toLlmUnavailableMessage(
  error: unknown,
  nodeEnv: NodeEnvironment
): string {
  const detail =
    error instanceof Error ? error.message : "模型请求失败，请稍后重试"
  logger.error(`LLM stream failed: ${detail}`, error instanceof Error ? error.stack : undefined)
  return nodeEnv !== "production" ? `AI 服务暂不可用：${detail}` : "AI 服务暂不可用"
}

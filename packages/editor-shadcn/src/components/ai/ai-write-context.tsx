"use client"

import { createContext } from "react"

/** 宿主（如文档工作区）注入的 AI 写作入口回调 */
export type AiWriteHostHandlers = {
  openSlash: () => void
  openSelection: () => void
}

/**
 * 由 apps/web 的 AiWritingHost 提供；未挂载时斜杠/气泡入口静默 no-op。
 */
export const AiWriteHostContext = createContext<AiWriteHostHandlers | null>(
  null
)

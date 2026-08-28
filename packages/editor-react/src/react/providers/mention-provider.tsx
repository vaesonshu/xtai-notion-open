"use client"

import { createContext, use } from "react"
import type { MentionProvider } from "@xtai-notion/editor-core/mention"

/** 点击提及链接后的跳转动作，由宿主应用注入（例如使用路由 push）。 */
export type MentionNavigate = (href: string) => void

/** 提及候选来源与跳转行为的上下文。 */
export type MentionContextValue = {
  /** 提供 @ 提及候选文档；为 null 时提及菜单不返回任何结果。 */
  provider: MentionProvider | null
  /** 点击提及链接时调用；为 null 时回退为浏览器默认跳转。 */
  navigate: MentionNavigate | null
}

export const MentionContext = createContext<MentionContextValue>({
  provider: null,
  navigate: null,
})

export function useMentionContext(): MentionContextValue {
  return use(MentionContext)
}

export function useMentionProvider(): MentionProvider | null {
  return use(MentionContext).provider
}

export function useMentionNavigate(): MentionNavigate | null {
  return use(MentionContext).navigate
}

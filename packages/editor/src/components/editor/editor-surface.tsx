"use client"

import { use, type MouseEvent } from "react"
import { EditorContent } from "../../react/editor-content"
import { EditorContext } from "../../react/context/editor-context"
import { useMentionNavigate } from "../../react/providers/mention-provider"
import { BlockHandle } from "../handles/block-handle"
import { BubbleToolbar } from "../menus/bubble-toolbar"
import { MentionMenu } from "../menus/mention-menu"
import { SlashMenu } from "../menus/slash-menu"
import { TableMenu } from "../menus/table-menu"

export type EditorSurfaceProps = {
  className?: string
}

export function EditorSurface({ className }: EditorSurfaceProps) {
  const context = use(EditorContext)
  const navigate = useMentionNavigate()

  if (!context?.editor) {
    return (
      <div
        className="flex min-h-[28rem] w-full flex-col gap-5 px-10 py-8"
        role="status"
        aria-label="正在加载编辑器"
      >
        <span className="h-8 w-2/3 animate-pulse rounded-md bg-[#D8D2C4]" />
        <div className="flex flex-col gap-3">
          <span className="h-4 w-full animate-pulse rounded bg-[#E2DED5]" />
          <span className="h-4 w-11/12 animate-pulse rounded bg-[#E2DED5]" />
          <span className="h-4 w-4/5 animate-pulse rounded bg-[#E2DED5]" />
        </div>
        <span className="sr-only">正在加载编辑器内容</span>
      </div>
    )
  }

  // 在编辑器容器上统一处理提及节点的点击：定位到最近的
  // [data-mention="true"] 元素，阻止默认跳转并交由宿主注入的导航回调处理
  // （SPA 路由跳转）。
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null
    const link = target?.closest<HTMLAnchorElement>('[data-mention="true"]')
    if (!link) {
      return
    }
    event.preventDefault()
    const href = link.getAttribute("href")
    if (navigate && href) {
      navigate(href)
    } else if (href) {
      window.location.href = href
    }
  }

  return (
    <div onClick={handleClick}>
      <EditorContent className={className} />
      {context.editor.isEditable ? (
        <>
          <SlashMenu />
          <MentionMenu />
          <BubbleToolbar />
          <TableMenu />
          <BlockHandle />
        </>
      ) : null}
    </div>
  )
}

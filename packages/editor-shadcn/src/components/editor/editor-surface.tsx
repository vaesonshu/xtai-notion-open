"use client"

import { use, useState, type MouseEvent } from "react"
import { EditorContent } from "@xtai-notion/editor-react/editor-content"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import { useMentionNavigate } from "@xtai-notion/editor-react/providers/mention-provider"
import { BlockHandle } from "../handles/block-handle"
import {
  LinkClickMenu,
  type LinkClickMenuState,
} from "../menus/link-click-menu"
import { BubbleToolbar } from "../menus/bubble-toolbar"
import { MentionMenu } from "../menus/mention-menu"
import { SlashMenu } from "../menus/slash-menu"
import { TableMenu } from "../menus/table-menu"
import { captureLinkMarkRange } from "./capture-link-range"
import {
  isInlineEditorLink,
  openEditorHref,
  resolveProseMirrorLink,
} from "./open-editor-href"
import { dismissSlashMenu } from "../menus/dismiss-slash-menu"

export type EditorSurfaceProps = {
  className?: string
}

export function EditorSurface({ className }: EditorSurfaceProps) {
  const context = use(EditorContext)
  const navigate = useMentionNavigate()
  const [linkMenu, setLinkMenu] = useState<LinkClickMenuState | null>(null)

  if (!context?.blockEditor) {
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

  const editor = context.blockEditor.tiptap
  const isEditable = editor.isEditable
  const mentionNavigate = navigate ?? undefined

  // 编辑态：行内链接弹出「编辑/打开」；查看态与提及节点：直接跳转
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const link = resolveProseMirrorLink(event.target)
    if (!link) {
      return
    }

    const href = link.getAttribute("href")
    if (!href) {
      return
    }

    event.preventDefault()

    if (isEditable && isInlineEditorLink(link)) {
      const linkRange = captureLinkMarkRange(editor, link)
      if (!linkRange) {
        return
      }

      dismissSlashMenu(editor)
      editor.commands.blur()

      setLinkMenu({
        href,
        anchorRect: link.getBoundingClientRect(),
        linkRange,
      })
      return
    }

    openEditorHref(href, mentionNavigate)
  }

  return (
    <div onClick={handleClick}>
      <EditorContent className={className} />
      {isEditable ? (
        <>
          <SlashMenu />
          <MentionMenu />
          <BubbleToolbar />
          <TableMenu />
          <BlockHandle />
          {linkMenu ? (
            <LinkClickMenu
              editor={editor}
              state={linkMenu}
              navigate={mentionNavigate}
              onClose={() => setLinkMenu(null)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

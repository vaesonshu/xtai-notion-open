"use client"

import { use } from "react"
import { EditorContent } from "../react/editor-content"
import { EditorContext } from "../react/editor-context"
import { BlockHandle } from "./block-handle"
import { BubbleToolbar } from "./bubble-toolbar"
import { SlashMenu } from "./slash-menu"

export type EditorSurfaceProps = {
  className?: string
}

export function EditorSurface({ className }: EditorSurfaceProps) {
  const context = use(EditorContext)
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

  return (
    <>
      <EditorContent className={className} />
      {context.editor.isEditable ? (
        <>
          <SlashMenu />
          <BubbleToolbar />
          <BlockHandle />
        </>
      ) : null}
    </>
  )
}

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
    return null
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

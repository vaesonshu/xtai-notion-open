"use client"

import { use } from "react"
import { EditorContent } from "../react/editor-content"
import { EditorContext } from "../react/editor-context"

export type EditorSurfaceProps = {
  className?: string
}

export function EditorSurface({ className }: EditorSurfaceProps) {
  const context = use(EditorContext)
  if (!context?.editor) {
    return null
  }

  return <EditorContent className={className} />
}

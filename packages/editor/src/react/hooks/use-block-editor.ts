"use client"

import { use } from "react"
import type { BlockEditor } from "@workspace/editor-core"
import { EditorContext } from "../context/editor-context"

/** 获取当前文档的 BlockEditor 门面（块 API + 内部 tiptap）。 */
export function useBlockEditor(): BlockEditor {
  const context = use(EditorContext)
  if (!context) {
    throw new Error(
      "useBlockEditor must be used inside @workspace/editor EditorProvider"
    )
  }
  if (!context.blockEditor) {
    throw new Error("useBlockEditor: editor is not ready yet")
  }
  return context.blockEditor
}

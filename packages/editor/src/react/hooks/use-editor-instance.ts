"use client"

import { use } from "react"
import type { Editor } from "@tiptap/core"
import { EditorContext } from "../context/editor-context"

/** @internal 组件内部绑定 Tiptap 视图时使用；包外请用 useBlockEditor。 */
export function useEditorInstance(): Editor {
  const context = use(EditorContext)
  if (!context) {
    throw new Error(
      "useEditorInstance must be used inside @workspace/editor EditorProvider"
    )
  }
  if (!context.blockEditor) {
    throw new Error("useEditorInstance: editor is not ready yet")
  }
  return context.blockEditor.tiptap
}

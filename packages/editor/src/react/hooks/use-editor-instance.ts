"use client"

import { use } from "react"
import type { Editor } from "@tiptap/core"
import { EditorContext } from "../context/editor-context"

export function useEditorInstance(): Editor {
  const context = use(EditorContext)
  if (!context) {
    throw new Error(
      "useEditorInstance must be used inside @workspace/editor EditorProvider"
    )
  }
  if (!context.editor) {
    throw new Error("useEditorInstance: editor is not ready yet")
  }
  return context.editor
}

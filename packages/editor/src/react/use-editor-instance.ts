"use client"

import { use } from "react"
import type { Editor } from "@tiptap/core"
import { EditorContext } from "./editor-context.js"

export function useEditorInstance(): Editor {
  const editor = use(EditorContext)
  if (!editor) {
    throw new Error("useEditorInstance must be used inside @workspace/editor EditorProvider")
  }
  return editor
}

import type { Editor } from "@tiptap/core"
import { useCallback } from "react"
import { useEditorInstance } from "./use-editor-instance"

function nodeText(node: any): string {
  if (!node) return ""
  if (typeof node.text === "string") return node.text
  const children = Array.isArray(node.content)
    ? node.content.map(nodeText).join("")
    : ""
  return node.type === "doc" ? children : `${children}\n`
}

/** Read the current JSON snapshot on demand so collaboration updates are not stale. */
export function getEditorText(editor: Editor): string {
  return nodeText(editor.getJSON()).trim()
}

export function useEditorText(): () => string {
  const editor = useEditorInstance()
  return useCallback(() => getEditorText(editor), [editor])
}

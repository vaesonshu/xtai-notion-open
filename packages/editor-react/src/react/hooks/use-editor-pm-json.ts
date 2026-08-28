"use client"

import { useEffect, useState } from "react"
import { useBlockEditor } from "./use-block-editor"

export type UseEditorPmJsonOptions = {
  /** 每次 PM 文档树变化时触发，适合 console.log 调试。 */
  onChange?: (json: Record<string, unknown>) => void
}

/**
 * 订阅当前 ProseMirror 文档 JSON（Tiptap state.doc.toJSON()）。
 * 需在 EditorProvider / CollaborationEditorProvider 内部使用。
 */
export function useEditorPmJson(
  options?: UseEditorPmJsonOptions
): Record<string, unknown> {
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap
  const onChange = options?.onChange
  const [json, setJson] = useState<Record<string, unknown>>(() =>
    editor.state.doc.toJSON()
  )

  useEffect(() => {
    const handler = () => {
      const next = editor.state.doc.toJSON()
      setJson(next)
      onChange?.(next)
    }
    editor.on("update", handler)
    return () => {
      editor.off("update", handler)
    }
  }, [editor, onChange])

  return json
}

"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Editor } from "@tiptap/core"
import { EditorContext } from "./editor-context"
import { createEditorExtensions } from "../core/extensions"
import { createInitialDocument } from "../core/initial-document"
import type { EditorDocument } from "../core/types"

export type EditorProviderProps = {
  initialContent?: EditorDocument
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  children: ReactNode
}

export function EditorProvider({ initialContent, editable = true, onChange, children }: EditorProviderProps) {
  const [editor] = useState(() => new Editor({
    extensions: createEditorExtensions(),
    content: initialContent ?? createInitialDocument(),
    editable,
  }))

  useEffect(() => {
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    const handleUpdate = () => onChange?.(editor.getJSON() as EditorDocument)
    editor.on("update", handleUpdate)
    return () => { editor.off("update", handleUpdate) }
  }, [editor, onChange])

  useEffect(() => {
    return () => { editor.destroy() }
  }, [editor])

  return (
    <EditorContext
      value={{
        editor,
        collaborationStatus: null,
        collaborators: [],
      }}
    >
      {children}
    </EditorContext>
  )
}

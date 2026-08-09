"use client"

import { EditorContent as TiptapEditorContent } from "@tiptap/react"
import { useEditorInstance } from "./use-editor-instance.js"

export type EditorContentProps = { className?: string }

export function EditorContent({ className }: EditorContentProps) {
  const editor = useEditorInstance()
  return <TiptapEditorContent className={className} editor={editor} />
}

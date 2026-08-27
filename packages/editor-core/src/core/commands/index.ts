import type { Editor } from "@tiptap/core"

export type InlineMark = "bold" | "italic" | "underline" | "strike" | "code"

export function toggleInlineMark(editor: Editor, mark: InlineMark): boolean {
  return editor.chain().focus().toggleMark(mark).run()
}

export function setEditorLink(editor: Editor, href: string): boolean {
  const chain = editor.chain().focus()
  return href.trim() ? chain.setLink({ href }).run() : chain.unsetLink().run()
}

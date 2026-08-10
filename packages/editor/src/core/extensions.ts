import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"
import type { Extensions } from "@tiptap/core"
import type { EditorExtensionOptions } from "./types"

export type { EditorExtensionOptions } from "./types"

export function createEditorExtensions(options: EditorExtensionOptions = {}): Extensions {
  const isCollaborative = Boolean(options.document && options.provider && options.user)
  const extensions: Extensions = [
    StarterKit.configure({ undoRedo: isCollaborative ? false : {} }),
    Link.configure({ openOnClick: false, autolink: true }),
    Underline,
    TaskList,
    TaskItem.configure({ nested: false }),
    Placeholder.configure({ placeholder: options.placeholder ?? "输入 / 查看块类型" }),
  ]

  if (isCollaborative) {
    extensions.push(
      Collaboration.configure({ document: options.document, provider: options.provider }),
      CollaborationCaret.configure({ provider: options.provider, user: options.user }),
    )
  }

  return extensions
}
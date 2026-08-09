import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"
import type { Extensions } from "@tiptap/core"

export type EditorExtensionOptions = {
  placeholder?: string
}

export function createEditorExtensions(options: EditorExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({ undoRedo: {} }),
    Link.configure({ openOnClick: false, autolink: true }),
    Underline,
    TaskList,
    TaskItem.configure({ nested: false }),
    Placeholder.configure({ placeholder: options.placeholder ?? "输入 / 查看块类型" }),
  ]
}

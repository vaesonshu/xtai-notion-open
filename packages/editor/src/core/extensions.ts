import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Image from "@tiptap/extension-image"
import Dropcursor from "@tiptap/extension-dropcursor"
import Placeholder from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import StarterKit from "@tiptap/starter-kit"
import type { Extensions } from "@tiptap/core"
import type { EditorExtensionOptions } from "./types"
import { ImageUpload } from "./image-upload-node"

export type { EditorExtensionOptions } from "./types"

export function createEditorExtensions(
  options: EditorExtensionOptions = {}
): Extensions {
  const isCollaborative = Boolean(
    options.document && options.provider && options.user
  )
  const extensions: Extensions = [
    StarterKit.configure({
      dropcursor: false,
      link: { openOnClick: false, autolink: true },
      undoRedo: isCollaborative ? false : {},
    }),
    Dropcursor.configure({
      color: "#24866B",
      width: 2,
      class: "ProseMirror-dropcursor",
    }),
    TaskList,
    TaskItem.configure({ nested: false }),
    Placeholder.configure({
      placeholder: options.placeholder ?? "输入 / 查看块类型",
    }),
    Image.configure({ inline: false, allowBase64: false }),
    ImageUpload.configure({ upload: options.imageUpload }),
  ]

  if (isCollaborative) {
    extensions.push(
      Collaboration.configure({
        document: options.document,
        provider: options.provider,
      }),
      CollaborationCaret.configure({
        provider: options.provider,
        user: options.user,
      })
    )
  }

  return extensions
}

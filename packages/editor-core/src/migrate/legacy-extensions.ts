import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Image from "@tiptap/extension-image"
import Dropcursor from "@tiptap/extension-dropcursor"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import StarterKit from "@tiptap/starter-kit"
import type { Extensions } from "@tiptap/core"
import type { EditorExtensionOptions } from "../types"
import { CanvasBlockNode } from "../extensions/canvas-block-node"
import { ImageUploadNode } from "../extensions/image-upload-node"
import { MentionNode } from "../extensions/index"

/**
 * v1 StarterKit 扩展工厂：仅供 Task 8 读取未迁移的 Y.Doc 快照。
 * 新代码应使用 createEditorExtensions（块 schema）。
 */
export function createLegacyEditorExtensions(
  options: EditorExtensionOptions = {}
): Extensions {
  const bindsCollaborationDocument = Boolean(options.document)
  const isCollaborativeSession = Boolean(
    options.document && options.provider && options.user
  )
  const extensions: Extensions = [
    StarterKit.configure({
      dropcursor: false,
      link: { openOnClick: false, autolink: true },
      undoRedo: bindsCollaborationDocument ? false : {},
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
    (options.imageUploadNode ?? ImageUploadNode).configure({
      upload: options.imageUpload,
    }),
    (options.canvasBlockNode ?? CanvasBlockNode).configure({
      upload: options.imageUpload,
      fetchImage: options.canvasImageFetch,
    }),
    MentionNode,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
  ]

  if (bindsCollaborationDocument && options.document) {
    extensions.push(
      Collaboration.configure({
        document: options.document,
        ...(options.provider ? { provider: options.provider } : {}),
      })
    )
    if (isCollaborativeSession && options.provider && options.user) {
      extensions.push(
        CollaborationCaret.configure({
          provider: options.provider,
          user: options.user,
        })
      )
    }
  }

  return extensions
}

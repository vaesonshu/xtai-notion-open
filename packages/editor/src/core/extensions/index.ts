import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Image from "@tiptap/extension-image"
import Dropcursor from "@tiptap/extension-dropcursor"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import StarterKit from "@tiptap/starter-kit"
import { mergeAttributes } from "@tiptap/core"
import type { Extensions } from "@tiptap/core"
import type { EditorExtensionOptions } from "../types"
import { CanvasBlockNode } from "./canvas-block-node"
import { ImageUploadNode } from "./image-upload-node"

export type { EditorExtensionOptions } from "../types"

/**
 * 文档提及节点：基于 @tiptap/extension-mention 的原子节点（atom），光标不可
 * 进入其中，从根本上避免“选中提及后继续输入会延续链接下划线”的问题。
 * 额外挂载 href 属性并将其渲染为可点击的 `<a>`，供点击跳转使用。
 */
export const MentionNode = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
        renderHTML: (attributes) =>
          attributes.href ? { href: attributes.href } : {},
      },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label ?? node.attrs.id ?? ""
    return [
      "a",
      mergeAttributes(
        { "data-type": this.name, "data-mention": "true" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `@${label}`,
    ]
  },
  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id ?? ""}`
  },
})

export function createEditorExtensions(
  options: EditorExtensionOptions = {}
): Extensions {
  // 绑定 Y.Doc 时禁用本地撤销栈；完整协作会话才挂载光标扩展。
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
    // 图片上传节点：默认使用 core 层的纯 Node（无 React 渲染）；React 层可通过
    // options.imageUploadNode 注入挂载了 ReactNodeViewRenderer 的版本。
    (options.imageUploadNode ?? ImageUploadNode).configure({
      upload: options.imageUpload,
    }),
    options.canvasBlockNode ?? CanvasBlockNode,
    MentionNode,
    // 表格：官方 Table/Row/Header/Cell 四件套，StarterKit 不含表格需显式注册。
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

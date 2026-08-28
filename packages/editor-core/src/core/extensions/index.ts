import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Dropcursor from "@tiptap/extension-dropcursor"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import StarterKit from "@tiptap/starter-kit"
import { mergeAttributes } from "@tiptap/core"
import type { Extensions, Node } from "@tiptap/core"
import { blockContentExtensions } from "../block-schema/block-content"
import { BlockContainer, BlockDoc, BlockGroup } from "../block-schema/pm-nodes"
import type { EditorExtensionOptions } from "../types"
import { BlockKeymap } from "./block-keymap"
import { CheckListItemClick } from "./check-list-item-click"

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

/** 默认编辑器扩展：块 schema（与 createBlockSchemaExtensions 等价） */
export function createEditorExtensions(
  options: EditorExtensionOptions = {}
): Extensions {
  return createBlockSchemaExtensions(options)
}

function resolveBlockContentExtensions(
  options: EditorExtensionOptions
): Extensions {
  const configuredCanvas = options.canvasBlockNode
    ? options.canvasBlockNode.configure({
        upload: options.imageUpload,
        fetchImage: options.canvasImageFetch,
      })
    : null

  // 带 NodeView 的 canvas 扩展替换默认 CanvasBlock，避免 canvas / canvasBlock 双节点并存
  return blockContentExtensions.map((extension: Node) =>
    extension.name === "canvas" && configuredCanvas
      ? configuredCanvas
      : extension
  )
}

/** 块文档 schema：Doc/blockGroup/blockContainer + 全部 blockContent 节点 */
export function createBlockSchemaExtensions(
  options: EditorExtensionOptions = {}
): Extensions {
  const bindsCollaborationDocument = Boolean(options.document)
  const isCollaborativeSession = Boolean(
    options.document && options.provider && options.user
  )

  const extensions: Extensions = [
    StarterKit.configure({
      document: false,
      paragraph: false,
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      dropcursor: false,
      link: { openOnClick: false, autolink: true },
      undoRedo: bindsCollaborationDocument ? false : {},
    }),
    BlockDoc,
    BlockGroup,
    BlockContainer,
    ...resolveBlockContentExtensions(options),
    BlockKeymap,
    CheckListItemClick,
    TableRow,
    TableHeader,
    TableCell,
    Dropcursor.configure({
      color: "#24866B",
      width: 2,
      class: "ProseMirror-dropcursor",
    }),
    Placeholder.configure({
      placeholder: options.placeholder ?? "输入 / 查看块类型",
    }),
    MentionNode,
  ]

  if (options.imageUploadNode) {
    extensions.push(
      options.imageUploadNode.configure({
        upload: options.imageUpload,
      })
    )
  }

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

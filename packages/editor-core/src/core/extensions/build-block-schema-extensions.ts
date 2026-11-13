import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { BlockDropcursor } from "./block-dropcursor"
import { createAiWriteAgentCursorExtension } from "./ai-write-agent-cursor-extension"
import { createAiWriteDraftExtension } from "./ai-write-draft-extension"
import { createDocumentAgentSelectionExtension } from "./document-agent-selection-extension"
import { createDocumentCommentMarkExtension } from "./document-comment-mark-extension"
import { createBlockPlaceholderExtension } from "./block-placeholder-extension"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import StarterKit from "@tiptap/starter-kit"
import type { Extension, Extensions, Node } from "@tiptap/core"
import { BlockContainer, BlockDoc, BlockGroup } from "../schema/pm-nodes"
import type { EditorExtensionOptions } from "../types"
import { BlockKeymap } from "./block-keymap"
import { MarkdownInputRules } from "./markdown-input-rules"
import { CheckListItemClick } from "./check-list-item-click"
import { EditorLink, EditorStrike } from "./inline-mark-extensions"
import { MentionNode } from "./mention-node"
import type { BlockSchemaRegistry } from "../schema/registry"

function resolveBlockContentExtensions(
  registry: BlockSchemaRegistry,
  options: EditorExtensionOptions
): Extensions {
  const configuredCanvas = options.canvasBlockNode
    ? options.canvasBlockNode.configure({
        upload: options.imageUpload,
        fetchImage: options.canvasImageFetch,
      })
    : null

  return registry
    .getBlockContentExtensions()
    .map((extension: Node) =>
      extension.name === "canvas" && configuredCanvas
        ? configuredCanvas
        : extension
    )
}

/** 根据 registry 组装完整 Tiptap 扩展列表 */
export function buildBlockSchemaExtensions(
  registry: BlockSchemaRegistry,
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
      // 使用 non-inclusive 的 link/strike，避免在 mark 末尾继续输入时延续样式
      link: false,
      strike: false,
      // 点击跳转由 EditorSurface 统一处理，以便 SPA 路由与外链新标签分流
      undoRedo: bindsCollaborationDocument ? false : {},
    }),
    EditorLink.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        class: "editor-inline-link",
        rel: "noopener noreferrer",
      },
    }),
    EditorStrike,
    // 文字颜色依赖 TextStyle mark 承载 color 属性
    TextStyle,
    Color.configure({ types: ["textStyle"] }),
    BlockDoc,
    BlockGroup,
    BlockContainer,
    ...resolveBlockContentExtensions(registry, options),
    MarkdownInputRules,
    BlockKeymap,
    CheckListItemClick,
    TableRow,
    TableHeader,
    TableCell,
    BlockDropcursor.configure({
      color: "#24866B",
      width: 2,
      class: "ProseMirror-dropcursor",
    }),
    createBlockPlaceholderExtension(options),
    // AI 写入态只走 PM 装饰，避免把 class / 光标写入协作文档
    createAiWriteDraftExtension(),
    createDocumentCommentMarkExtension(),
    createDocumentAgentSelectionExtension(),
    createAiWriteAgentCursorExtension(),
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

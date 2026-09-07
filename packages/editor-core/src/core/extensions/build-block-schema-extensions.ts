import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { BlockDropcursor } from "./block-dropcursor"
import { createAiWriteAgentCursorExtension } from "./ai-write-agent-cursor-extension"
import { createAiWriteDraftExtension } from "./ai-write-draft-extension"
import { createDocumentCommentMarkExtension } from "./document-comment-mark-extension"
import { createBlockPlaceholderExtension } from "./block-placeholder-extension"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import StarterKit from "@tiptap/starter-kit"
import type { Extension, Extensions, Node } from "@tiptap/core"
import { BlockContainer, BlockDoc, BlockGroup } from "../block-schema/pm-nodes"
import type { EditorExtensionOptions } from "../types"
import { BlockKeymap } from "./block-keymap"
import { CheckListItemClick } from "./check-list-item-click"
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
      link: { openOnClick: false, autolink: true },
      undoRedo: bindsCollaborationDocument ? false : {},
    }),
    // 文字颜色依赖 TextStyle mark 承载 color 属性
    TextStyle,
    Color.configure({ types: ["textStyle"] }),
    BlockDoc,
    BlockGroup,
    BlockContainer,
    ...resolveBlockContentExtensions(registry, options),
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

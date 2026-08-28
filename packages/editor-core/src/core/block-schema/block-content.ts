import { Node, mergeAttributes } from "@tiptap/core"
import { Table } from "@tiptap/extension-table"
import { createCanvasBlockId } from "../canvas/canvas-snapshot"
import type { BlockType } from "./types"

/** 所有 blockContent 节点名，与 BlockType 一一对应 */
export const BLOCK_CONTENT_NODE_NAMES: BlockType[] = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
  "divider",
  "image",
  "table",
  "canvas",
]

export const ParagraphBlock = Node.create({
  name: "paragraph",
  // 同时属于 blockContent 与 block，供 tableCell 内嵌段落
  group: "blockContent block",
  content: "inline*",

  parseHTML() {
    return [{ tag: "p" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes), 0]
  },
})

export const HeadingBlock = Node.create({
  name: "heading",
  group: "blockContent",
  content: "inline*",

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (element) =>
          Number.parseInt(element.tagName.charAt(1), 10) || 1,
        renderHTML: (attributes) => {
          const level = attributes.level as 1 | 2 | 3
          return level ? {} : {}
        },
      },
    }
  },

  parseHTML() {
    return [1, 2, 3].map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    }))
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as 1 | 2 | 3
    return [`h${level}`, mergeAttributes(HTMLAttributes), 0]
  },
})

export const BulletListItemBlock = Node.create({
  name: "bulletListItem",
  group: "blockContent",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'li[data-type="bulletListItem"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes({ "data-type": "bulletListItem" }, HTMLAttributes),
      0,
    ]
  },
})

export const NumberedListItemBlock = Node.create({
  name: "numberedListItem",
  group: "blockContent",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'li[data-type="numberedListItem"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes({ "data-type": "numberedListItem" }, HTMLAttributes),
      0,
    ]
  },
})

export const CheckListItemBlock = Node.create({
  name: "checkListItem",
  group: "blockContent",
  content: "inline*",

  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-checked") === "true",
        renderHTML: (attributes) =>
          attributes.checked ? { "data-checked": "true" } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'li[data-type="checkListItem"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes({ "data-type": "checkListItem" }, HTMLAttributes),
      0,
    ]
  },
})

/** 引用块直接承载行内，不再包一层 paragraph */
export const QuoteBlock = Node.create({
  name: "quote",
  group: "blockContent",
  content: "inline*",

  parseHTML() {
    return [{ tag: "blockquote" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["blockquote", mergeAttributes(HTMLAttributes), 0]
  },
})

/** 代码块只接受纯文本节点，样式 marks 在 convert 层剥离 */
export const CodeBlockContent = Node.create({
  name: "codeBlock",
  group: "blockContent",
  content: "text*",
  code: true,

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-language"),
        renderHTML: (attributes) =>
          attributes.language ? { "data-language": attributes.language } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: "pre" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["pre", mergeAttributes(HTMLAttributes), ["code", 0]]
  },
})

export const DividerBlock = Node.create({
  name: "divider",
  group: "blockContent",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "hr" }]
  },

  renderHTML() {
    return ["hr"]
  },
})

/**
 * 合并旧 image / imageUpload：无 src 且 uploadStatus 为 idle 表示上传占位。
 */
export const ImageBlock = Node.create({
  name: "image",
  group: "blockContent",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) =>
          attributes.src ? { src: attributes.src } : {},
      },
      uploadStatus: {
        default: "idle",
        parseHTML: (element) =>
          element.getAttribute("data-upload-status") ?? "idle",
        renderHTML: (attributes) =>
          attributes.uploadStatus
            ? { "data-upload-status": attributes.uploadStatus }
            : {},
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'img[data-type="image"]' },
      { tag: 'div[data-type="image-upload"]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes({ "data-type": "image" }, HTMLAttributes)]
  },
})

/** 表格外壳属于 blockContent；行列单元格仍用官方 tableRow/Header/Cell */
export const BlockTable = Table.extend({
  name: "table",
  group: "blockContent",
})

/** Excalidraw 画板：快照存在 attrs，Block.type 为 canvas */
export const CanvasBlock = Node.create({
  name: "canvas",
  group: "blockContent",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      canvasId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-canvas-id"),
        renderHTML: (attributes) =>
          attributes.canvasId ? { "data-canvas-id": attributes.canvasId } : {},
      },
      snapshot: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-snapshot") ?? "",
        renderHTML: (attributes) =>
          attributes.snapshot ? { "data-snapshot": attributes.snapshot } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="canvas-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "canvas-block" }, HTMLAttributes),
    ]
  },

  addCommands() {
    return {
      insertCanvasBlock:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              canvasId: createCanvasBlockId(),
              snapshot: "",
            },
          }),
    }
  },
})

export const blockContentExtensions = [
  ParagraphBlock,
  HeadingBlock,
  BulletListItemBlock,
  NumberedListItemBlock,
  CheckListItemBlock,
  QuoteBlock,
  CodeBlockContent,
  DividerBlock,
  ImageBlock,
  BlockTable,
  CanvasBlock,
]

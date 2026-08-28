import { Node, mergeAttributes } from "@tiptap/core"
import { Table } from "@tiptap/extension-table"
import { createCanvasBlockId } from "../canvas/canvas-snapshot"

/** 代码块只接受纯文本节点，样式 marks 在 convert 层剥离（P2 待迁入 default-specs） */
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

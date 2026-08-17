import { Node, mergeAttributes } from "@tiptap/core"
import { createCanvasBlockId } from "../canvas/canvas-snapshot"

import type { ImageUploadHandler } from "../image-upload"
import type { CanvasImageFetchHandler } from "../canvas/canvas-files"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    canvasBlock: {
      insertCanvasBlock: () => ReturnType
    }
  }
}

/**
 * Excalidraw 画板内嵌块：原子块节点，场景快照存在 attrs.snapshot 中，
 * 经 TipTap Collaboration + Yjs 与协作者同步。
 */
export const CanvasBlockNode = Node.create<{
  upload?: ImageUploadHandler
  fetchImage?: CanvasImageFetchHandler
}>({
  name: "canvasBlock",
  group: "block",
  atom: true,
  selectable: true,

  addOptions() {
    return {
      upload: undefined,
      fetchImage: undefined,
    }
  },

  addAttributes() {
    return {
      canvasId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-canvas-id"),
        renderHTML: (attributes) =>
          attributes.canvasId ? { "data-canvas-id": attributes.canvasId } : {},
      },
      // Excalidraw elements + files 的 JSON 字符串
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

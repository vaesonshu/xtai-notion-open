"use client"

import { ReactNodeViewRenderer } from "@tiptap/react"
import { CanvasBlock } from "@xtai-notion/editor-core/block-schema/block-content"
import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import { CanvasBlockNode as CanvasBlockNodeView } from "./canvas-block-node"

/** 块 schema 的 canvas 节点 + React NodeView，在文档内渲染 Excalidraw 画板。 */
export const CanvasBlockNode = CanvasBlock.extend({
  addOptions() {
    return {
      upload: undefined as ImageUploadHandler | undefined,
      fetchImage: undefined as CanvasImageFetchHandler | undefined,
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CanvasBlockNodeView)
  },
})

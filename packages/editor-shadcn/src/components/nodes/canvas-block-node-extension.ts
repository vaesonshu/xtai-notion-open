"use client"

import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import { canvasSpec } from "@xtai-notion/editor-core/schema"
import type { BlockSpec } from "@xtai-notion/editor-core/schema"
import { withReactNodeView } from "@xtai-notion/editor-react"
import { CanvasBlockNode as CanvasBlockNodeView } from "./canvas-block-node"

/** 带 Excalidraw NodeView 的画板块 spec，供 createEditorSchema({ override: { canvas } }) 使用 */
export function createCanvasBlockSpec(options: {
  upload?: ImageUploadHandler
  fetchImage?: CanvasImageFetchHandler
} = {}): BlockSpec {
  return withReactNodeView(canvasSpec, {
    component: CanvasBlockNodeView,
    addOptions: () => ({
      upload: options.upload,
      fetchImage: options.fetchImage,
    }),
  })
}

/** @deprecated 请改用 createCanvasBlockSpec + createEditorSchema override */
export const CanvasBlockNode = createCanvasBlockSpec().node

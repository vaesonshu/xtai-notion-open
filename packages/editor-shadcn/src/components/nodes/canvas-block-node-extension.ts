"use client"

import { ReactNodeViewRenderer } from "@tiptap/react"
import { CanvasBlockNode as CoreCanvasBlockNode } from "@xtai-notion/editor-core/extensions/canvas-block-node"
import { CanvasBlockNode as CanvasBlockNodeView } from "./canvas-block-node"

/** core schema + React NodeView，在文档内渲染 Excalidraw 画板。 */
export const CanvasBlockNode = CoreCanvasBlockNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CanvasBlockNodeView)
  },
})

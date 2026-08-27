"use client"

import { ReactNodeViewRenderer } from "@tiptap/react"
import { ImageUploadNode as CoreImageUploadNode } from "@xtai-notion/editor-core"
import { ImageUploadNode as ImageUploadNodeView } from "./image-upload-node"

/**
 * 挂载了 React 节点视图的图片上传节点。
 *
 * 复用 core 层的纯 Node 定义（schema/命令），仅在此处补上 React 渲染：
 * `ReactNodeViewRenderer` 将 `ImageUploadNodeView` 组件渲染进编辑器，
 * 实现上传占位、拖拽、进度与错误重试等交互。core 层保持框架无关。
 */
export const ImageUploadNode = CoreImageUploadNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageUploadNodeView)
  },
})

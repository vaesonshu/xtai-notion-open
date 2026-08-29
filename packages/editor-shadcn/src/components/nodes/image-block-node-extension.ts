"use client"

import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import { imageSpec } from "@xtai-notion/editor-core/schema"
import type { BlockSpec } from "@xtai-notion/editor-core/schema"
import { withReactNodeView } from "@xtai-notion/editor-react"
import { ImageBlockNode as ImageBlockNodeView } from "./image-upload-node"

/** 带上传 NodeView 的图片 blockContent spec，供 createEditorSchema({ override: { image } }) 使用 */
export function createImageBlockSpec(
  options: { upload?: ImageUploadHandler } = {}
): BlockSpec {
  return withReactNodeView(imageSpec, {
    component: ImageBlockNodeView,
    addOptions: () => ({
      upload: options.upload,
    }),
  })
}

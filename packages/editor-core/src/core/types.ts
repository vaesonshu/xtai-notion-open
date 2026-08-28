import type { Node } from "@tiptap/core"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import type * as Y from "yjs"
import type { ImageUploadHandler } from "./image-upload"
import type { CanvasImageFetchHandler } from "./canvas/canvas-files"

export type CollaborationUser = {
  id: string
  name: string
  color: string
}

export type EditorExtensionOptions = {
  placeholder?: string
  document?: Y.Doc
  provider?: HocuspocusProvider
  user?: CollaborationUser
  imageUpload?: ImageUploadHandler
  /** 画板导出/预览时拉取 COS 远程图片，避免跨域污染 canvas。 */
  canvasImageFetch?: CanvasImageFetchHandler
  /**
   * 可选：挂载了具体节点视图（如 React）的图片上传节点扩展。
   * 缺省时使用 core 层的纯 Node 定义（仅 schema/命令，无节点视图渲染）。
   */
  imageUploadNode?: Node
  /** 可选：挂载 Excalidraw NodeView 的画板块扩展。 */
  canvasBlockNode?: Node
}

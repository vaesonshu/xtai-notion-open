import type { JSONContent, Node } from "@tiptap/core"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import type * as Y from "yjs"
import type { ImageUploadHandler } from "./image-upload"

export type EditorDocument = JSONContent & {
  type: "doc"
  content: JSONContent[]
}

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
  /**
   * 可选：挂载了具体节点视图（如 React）的图片上传节点扩展。
   * 缺省时使用 core 层的纯 Node 定义（仅 schema/命令，无节点视图渲染）。
   */
  imageUploadNode?: Node
}

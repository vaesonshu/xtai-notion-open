import type { JSONContent } from "@tiptap/core"
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
}

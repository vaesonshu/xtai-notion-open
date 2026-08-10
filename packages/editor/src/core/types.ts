import type { JSONContent } from "@tiptap/core"

export type EditorDocument = JSONContent & {
  type: "doc"
  content: JSONContent[]
}

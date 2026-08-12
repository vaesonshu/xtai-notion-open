import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { ImageUploadHandler } from "./image-upload"
import { ImageUploadNode } from "../components/image-upload-node"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageUpload: {
      insertImageUpload: () => ReturnType
    }
  }
}

export const ImageUpload = Node.create<{ upload?: ImageUploadHandler }>({
  name: "imageUpload",
  group: "block",
  atom: true,
  selectable: true,

  addOptions() {
    return { upload: undefined }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-upload"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "image-upload" }, HTMLAttributes),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageUploadNode)
  },

  addCommands() {
    return {
      insertImageUpload:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    }
  },
})

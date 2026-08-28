import { Node, mergeAttributes } from "@tiptap/core"
import type { ImageUploadHandler } from "../image-upload"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageUpload: {
      insertImageUpload: () => ReturnType
    }
  }
}

/**
 * 图片上传占位节点的纯 TipTap 定义（框架无关）。
 *
 * 此节点只负责 schema、HTML 序列化与插入命令，不包含任何 React 渲染逻辑。
 * 具体的 React 节点视图由 `@xtai-notion/editor-react` / shadcn 层通过
 * `ImageUploadNode.extend({ addNodeView })` 挂载，从而让 core 保持
 * 不依赖 React（参考 BlockNote 的 core/react 分层思想）。
 */
export const ImageUploadNode = Node.create<{ upload?: ImageUploadHandler }>({
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

  addCommands() {
    return {
      insertImageUpload:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    }
  },
})

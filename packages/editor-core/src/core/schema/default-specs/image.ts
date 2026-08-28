import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

/**
 * 图片块：无 src 且 uploadStatus 为 idle 表示上传占位。
 * React 上传 UI 由 imageUpload 扩展或 defineReactBlockSpec 覆盖提供。
 */
export const imageSpec = defineBlockSpec(
  {
    type: "image",
    propSchema: {
      src: { default: "" },
      uploadStatus: { default: "idle" },
    },
    content: "none",
    isAtom: true,
  },
  {
    parseHTML: [
      { tag: 'img[data-type="image"]' },
      { tag: 'div[data-type="image-upload"]' },
    ],
    renderHTML: ({ HTMLAttributes }) => [
      "img",
      mergeAttributes({ "data-type": "image" }, HTMLAttributes),
    ],
  }
)

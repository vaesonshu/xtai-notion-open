import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

/** 引用块直接承载行内，不再包一层 paragraph */
export const quoteSpec = defineBlockSpec(
  {
    type: "quote",
    propSchema: {},
    content: "inline",
  },
  {
    parseHTML: [{ tag: "blockquote" }],
    renderHTML: ({ HTMLAttributes }) => [
      "blockquote",
      mergeAttributes(HTMLAttributes),
      0,
    ],
  }
)

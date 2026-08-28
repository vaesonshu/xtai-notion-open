import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

/** 标题块：level 1–3 对应 h1–h3 */
export const headingSpec = defineBlockSpec(
  {
    type: "heading",
    propSchema: { level: { default: 1 } },
    content: "inline",
  },
  {
    parseHTML: [1, 2, 3].map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    })),
    renderHTML: ({ node, HTMLAttributes }) => {
      const level = node.attrs.level as 1 | 2 | 3
      return [`h${level}`, mergeAttributes(HTMLAttributes), 0]
    },
  }
)

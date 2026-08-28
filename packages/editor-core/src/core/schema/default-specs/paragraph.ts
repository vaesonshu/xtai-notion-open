import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

/** 段落块：同时属于 blockContent 与 block，供 tableCell 内嵌段落 */
export const paragraphSpec = defineBlockSpec(
  {
    type: "paragraph",
    propSchema: {},
    content: "inline",
    alsoBlockGroup: true,
  },
  {
    parseHTML: [{ tag: "p" }],
    renderHTML: ({ HTMLAttributes }) => [
      "p",
      mergeAttributes(HTMLAttributes),
      0,
    ],
  }
)

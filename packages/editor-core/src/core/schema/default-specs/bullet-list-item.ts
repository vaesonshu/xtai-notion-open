import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

export const bulletListItemSpec = defineBlockSpec(
  {
    type: "bulletListItem",
    propSchema: {},
    content: "inline",
  },
  {
    parseHTML: [{ tag: 'li[data-type="bulletListItem"]' }],
    renderHTML: ({ HTMLAttributes }) => [
      "li",
      mergeAttributes({ "data-type": "bulletListItem" }, HTMLAttributes),
      0,
    ],
  }
)

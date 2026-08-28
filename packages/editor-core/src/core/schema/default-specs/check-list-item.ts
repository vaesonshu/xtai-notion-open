import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

export const checkListItemSpec = defineBlockSpec(
  {
    type: "checkListItem",
    propSchema: { checked: { default: false } },
    content: "inline",
  },
  {
    parseHTML: [{ tag: 'li[data-type="checkListItem"]' }],
    renderHTML: ({ HTMLAttributes }) => [
      "li",
      mergeAttributes({ "data-type": "checkListItem" }, HTMLAttributes),
      0,
    ],
  }
)

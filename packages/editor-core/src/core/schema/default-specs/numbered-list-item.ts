import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

export const numberedListItemSpec = defineBlockSpec(
  {
    type: "numberedListItem",
    propSchema: {},
    content: "inline",
  },
  {
    parseHTML: [{ tag: 'li[data-type="numberedListItem"]' }],
    renderHTML: ({ HTMLAttributes }) => [
      "li",
      mergeAttributes({ "data-type": "numberedListItem" }, HTMLAttributes),
      0,
    ],
  }
)

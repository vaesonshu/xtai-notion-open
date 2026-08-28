import { defineBlockSpec } from "../block-spec"

export const dividerSpec = defineBlockSpec(
  {
    type: "divider",
    propSchema: {},
    content: "none",
    isAtom: true,
  },
  {
    parseHTML: [{ tag: "hr" }],
    renderHTML: () => ["hr"],
  }
)

import { mergeAttributes } from "@tiptap/core"
import { defineBlockSpec } from "../block-spec"

/** 代码块只接受纯文本节点，样式 marks 在 convert 层剥离 */
export const codeBlockSpec = defineBlockSpec(
  {
    type: "codeBlock",
    propSchema: { language: { default: "" } },
    content: "text",
    code: true,
  },
  {
    parseHTML: [{ tag: "pre" }],
    renderHTML: ({ HTMLAttributes }) => [
      "pre",
      mergeAttributes(HTMLAttributes),
      ["code", 0],
    ],
  }
)

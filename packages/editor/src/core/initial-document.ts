import type { EditorDocument } from "./types.js"

export function createInitialDocument(): EditorDocument {
  return {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "让知识真正流动起来" }] },
      { type: "paragraph", content: [{ type: "text", text: "这是一个可编辑的知识文档。" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "记录想法" }] }] }] },
      { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "好的工具让秩序自然出现。" }] }] },
      { type: "codeBlock", content: [{ type: "text", text: "const knowledge = true" }] },
    ],
  }
}

import type { EditorDocument } from "../types"

export function createEmptyDocument(): EditorDocument {
  return {
    type: "doc",
    content: [],
  }
}

export function createStarterDocument(): EditorDocument {
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

export function isEditorDocument(value: unknown): value is EditorDocument {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const candidate = value as { type?: unknown; content?: unknown }

  return candidate.type === "doc" && Array.isArray(candidate.content)
}

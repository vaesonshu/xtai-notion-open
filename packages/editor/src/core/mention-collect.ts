import type { JSONContent } from "@tiptap/core"

/** 从 TipTap JSON 递归收集 mention 节点引用的文档 id（@提及关系）。 */
export function collectMentionIds(document: JSONContent): string[] {
  const ids: string[] = []

  const visit = (node: JSONContent) => {
    if (node.type === "mention" && typeof node.attrs?.id === "string") {
      ids.push(node.attrs.id)
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) visit(child)
    }
  }

  visit(document)
  return ids
}

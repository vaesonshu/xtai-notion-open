import type { Block, InlineContent, TableContent } from "./model/types"

/** 从 Block[] 递归收集 mention 引用的文档 id（@提及关系）。 */
export function collectMentionIds(blocks: Block[]): string[] {
  const ids: string[] = []

  const visitInline = (content: InlineContent[]) => {
    for (const item of content) {
      if (item.type === "mention" && item.id) {
        ids.push(item.id)
      } else if (item.type === "link") {
        visitInline(item.content)
      }
    }
  }

  const visit = (items: Block[]) => {
    for (const block of items) {
      if (Array.isArray(block.content)) {
        visitInline(block.content)
      } else if (block.content && "rows" in block.content) {
        const table = block.content as TableContent
        for (const row of table.rows) {
          for (const cell of row.cells) {
            visitInline(cell.content)
          }
        }
      }
      visit(block.children)
    }
  }

  visit(blocks)
  return ids
}

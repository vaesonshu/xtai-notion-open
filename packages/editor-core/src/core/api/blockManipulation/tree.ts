import type { Block } from "../../model/types"

/** 在 Block 树中按 id 查找节点（深度优先） */
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block
    }
    const nested = findBlockById(block.children, id)
    if (nested) {
      return nested
    }
  }
  return null
}

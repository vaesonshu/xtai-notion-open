/** AI 写作允许插入/更新的块类型（不含表格、图片等非文本块） */
export const AI_WRITABLE_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
] as const

export type AiWritableBlockType = (typeof AI_WRITABLE_BLOCK_TYPES)[number]

export type AiWriteMode = "slash" | "selection"

/** 发给模型的精简块视图：保留树结构与 id，附带纯文本与可写标记 */
export type AiBlockView = {
  id: string
  type: string
  text: string
  writable: boolean
  children: AiBlockView[]
}

export type AiInsertBlockInput = {
  type: AiWritableBlockType
  text: string
  props?: Record<string, unknown>
  id?: string
}

/** 客户端重放的 AI 写作操作；update_block 用 blockType 避免与 discriminant type 冲突 */
export type AiWriteOp =
  | {
      type: "insert_blocks"
      refId: string
      placement: "before" | "after"
      blocks: AiInsertBlockInput[]
    }
  | {
      type: "update_block"
      id: string
      blockType?: AiWritableBlockType
      text?: string
      props?: Record<string, unknown>
    }

export type AiWriteValidationContext = {
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
  snapshotIds: Set<string>
}

/** 判断块类型是否允许 AI 插入/更新 */
export function isAiWritableBlockType(
  type: string
): type is AiWritableBlockType {
  return (AI_WRITABLE_BLOCK_TYPES as readonly string[]).includes(type)
}

import type {
  AiInsertBlockInput,
  AiWriteOp,
  AiWriteValidationContext,
} from "./types"
import { isAiWritableBlockType } from "./types"

type ValidationResult =
  | { ok: true; op: AiWriteOp }
  | { ok: false; reason: string }

function fail(reason: string): ValidationResult {
  return { ok: false, reason }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseInsertBlockInput(value: unknown): AiInsertBlockInput | null {
  if (!isRecord(value)) {
    return null
  }
  const { type, text, props, id } = value
  if (typeof type !== "string" || !isAiWritableBlockType(type)) {
    return null
  }
  if (typeof text !== "string") {
    return null
  }
  if (props !== undefined && !isRecord(props)) {
    return null
  }
  if (id !== undefined && typeof id !== "string") {
    return null
  }
  return {
    type,
    text,
    ...(props !== undefined ? { props } : {}),
    ...(id !== undefined ? { id } : {}),
  }
}

function validateInsertBlocks(
  raw: Record<string, unknown>,
  context: AiWriteValidationContext
): ValidationResult {
  const { refId, placement, blocks } = raw
  if (typeof refId !== "string" || !context.snapshotIds.has(refId)) {
    return fail("insert_blocks refId 不在当前文档快照中")
  }
  if (placement !== "before" && placement !== "after") {
    return fail("insert_blocks placement 仅支持 before 或 after")
  }
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return fail("insert_blocks blocks 必须为非空数组")
  }

  const parsedBlocks: AiInsertBlockInput[] = []
  for (const block of blocks) {
    const parsed = parseInsertBlockInput(block)
    if (!parsed) {
      return fail("insert_blocks 含非法块：type 须为可写类型且 text 为字符串")
    }
    parsedBlocks.push(parsed)
  }

  // selection 模式：锚点必须在选区内；无选区则禁止插入
  if (context.mode === "selection") {
    if (context.selectedIds.length === 0) {
      return fail("selection 模式无选区时不可 insert_blocks")
    }
    if (!context.selectedIds.includes(refId)) {
      return fail("selection 模式 insert_blocks refId 须在选区内")
    }
  }

  return {
    ok: true,
    op: {
      type: "insert_blocks",
      refId,
      placement,
      blocks: parsedBlocks,
    },
  }
}

function validateUpdateBlock(
  raw: Record<string, unknown>,
  context: AiWriteValidationContext
): ValidationResult {
  const { id, blockType, text, props } = raw
  if (typeof id !== "string" || !context.snapshotIds.has(id)) {
    return fail("update_block id 不在当前文档快照中")
  }

  if (context.mode === "slash") {
    if (id !== context.cursorBlockId) {
      return fail("slash 模式 update_block 仅允许更新光标块")
    }
  } else if (!context.selectedIds.includes(id)) {
    return fail("selection 模式 update_block 仅允许更新选中的块")
  }

  if (blockType !== undefined) {
    if (typeof blockType !== "string" || !isAiWritableBlockType(blockType)) {
      return fail("update_block blockType 须为可写块类型")
    }
  }
  if (text !== undefined && typeof text !== "string") {
    return fail("update_block text 须为字符串")
  }
  if (props !== undefined && !isRecord(props)) {
    return fail("update_block props 须为对象")
  }
  if (text === undefined && blockType === undefined && props === undefined) {
    return fail("update_block 至少需提供 text、blockType 或 props 之一")
  }

  return {
    ok: true,
    op: {
      type: "update_block",
      id,
      ...(blockType !== undefined ? { blockType } : {}),
      ...(text !== undefined ? { text } : {}),
      ...(props !== undefined ? { props } : {}),
    },
  }
}

/** 按写作模式校验 AI 工具 op，拒绝 remove、nested 及越权更新 */
export function validateAiWriteOp(
  op: unknown,
  context: AiWriteValidationContext
): ValidationResult {
  if (!isRecord(op) || typeof op.type !== "string") {
    return fail("未知或非法的 op")
  }

  switch (op.type) {
    case "insert_blocks":
      return validateInsertBlocks(op, context)
    case "update_block":
      return validateUpdateBlock(op, context)
    case "remove_blocks":
      return fail("第一期不支持 remove_blocks")
    default:
      return fail(`未知 op 类型: ${op.type}`)
  }
}

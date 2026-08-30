export {
  AI_WRITABLE_BLOCK_TYPES,
  isAiWritableBlockType,
  type AiBlockView,
  type AiInsertBlockInput,
  type AiWriteMode,
  type AiWriteOp,
  type AiWriteValidationContext,
  type AiWritableBlockType,
} from "./types"
export {
  blocksToAiBlockViews,
  collectAiBlockIds,
  isEmptyTextBlock,
} from "./serialize"
export { validateAiWriteOp } from "./validate"
export {
  applyAiWriteOp,
  canReplayAiWriteOps,
  collectAiWriteDraftIds,
  collectAiWriteOpTargetIds,
  extractDraftBlocks,
  textToInlineContent,
} from "./apply"
export {
  parsePartialToolArgs,
  partialArgsHaveNonEmptyText,
  sanitizePartialToolArgs,
} from "./parse-partial"
// 流式打字机：fork 上按 toolIndex 复用已插入块，避免重复 insert
export {
  createAiWriteStreamApplier,
  type AiWritePartialEvent,
  type AiWriteStreamApplier,
} from "./apply-stream"

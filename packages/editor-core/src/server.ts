/**
 * 服务端安全入口：不含 @excalidraw/excalidraw 等浏览器侧依赖。
 * NestJS / 脚本应从此路径导入，避免 Node 解析 Excalidraw 子包失败。
 */
export type { Block } from "./core/block-schema/types"
export { generateBlockId } from "./core/block-schema/ids"
export {
  CURRENT_SCHEMA_VERSION,
  readYDocSchemaVersion,
  writeYDocSchemaVersion,
} from "./core/migrate"
export {
  appendTextToBlockSchemaYDoc,
  blockSchemaYDocHasContent,
  createBlockSchemaYDoc,
  documentFromYjs,
  documentToPlainText,
} from "./core/yjs-document"
export { collectMentionIds } from "./core/mention-collect"
export { blocksToMarkdown, markdownToBlocks } from "./core/markdown"
export {
  AI_WRITABLE_BLOCK_TYPES,
  blocksToAiBlockViews,
  collectAiBlockIds,
  isAiWritableBlockType,
  isEmptyTextBlock,
  parsePartialToolArgs,
  partialArgsHaveNonEmptyText,
  sanitizePartialToolArgs,
  validateAiWriteOp,
  type AiBlockView,
  type AiInsertBlockInput,
  type AiWriteMode,
  type AiWriteOp,
  type AiWriteValidationContext,
  type AiWritableBlockType,
} from "./core/ai-write"

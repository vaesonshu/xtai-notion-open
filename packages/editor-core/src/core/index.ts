export type { CollaborationUser, EditorExtensionOptions } from "./types"
export type {
  Block,
  BlockType,
  InlineContent,
  InlineStyles,
  PartialBlock,
  TableContent,
} from "./block-schema/types"
export { BlockEditor } from "./block-editor"
export type { BlockSideMenuState } from "./block-side-menu"
export type { BlockToolbarCommand } from "./block-toolbar"
export { getActiveBlockToolbarCommand } from "./block-toolbar"
export {
  getDraggableBlockFromElement,
  startBlockContainerDrag,
} from "./block-side-menu"
export { MAX_NEST_DEPTH, generateBlockId } from "./block-schema/ids"
export {
  createEmptyBlocks,
  createStarterBlocks,
  isBlockArray,
} from "./block-schema/documents"
export {
  CURRENT_SCHEMA_VERSION,
  readYDocSchemaVersion,
  writeYDocSchemaVersion,
} from "./migrate"
export {
  createBlockSchemaExtensions,
  createEditorExtensions,
  MentionNode,
} from "./extensions"
export type {
  BlockConfig,
  BlockContentMode,
  BlockSpec,
  CreateEditorSchemaOptions,
  DeclarativeBlockImplementation,
  EditorSchema,
  PropSchema,
  PropSpec,
} from "./schema"
export {
  BlockSchemaRegistry,
  createDefaultBlockSchemaRegistry,
  createEditorSchema,
  DEFAULT_BUILTIN_BLOCK_COUNT,
  defineBlockSpec,
  propsToAttributes,
} from "./schema"
export { setAiWriteDraftIds } from "./extensions/ai-write-draft-extension"
export {
  setDocumentCommentMarkIds,
  setDocumentCommentMarks,
} from "./extensions/document-comment-mark-extension"
export {
  setDocumentAgentSelectionTarget,
  type DocumentAgentSelectionState,
} from "./extensions/document-agent-selection-extension"
export {
  type CommentTextAnchor,
  type DocumentCommentMarkEntry,
  findCommentMarkAtPos,
  getCommentTextSelection,
} from "./document-comment-anchor"
export { setAiWriteAgentCursor } from "./extensions/ai-write-agent-cursor-extension"
export { ImageUploadNode } from "./extensions/image-upload-node"
export type { BlockCommandMode, SlashCommand } from "./slash-commands"
export {
  SLASH_COMMANDS,
  convertBlockCommand,
  executeSlashCommand,
  filterCommands,
  filterSlashCommands,
  getSlashCommands,
  UPLOAD_IMAGE_SLASH_COMMAND,
} from "./slash-commands"
export type { InlineMark } from "./commands"
export {
  normalizeTextColorInput,
  setEditorLink,
  setTextColor,
  toggleInlineMark,
  unsetTextColor,
} from "./commands"
export type {
  MentionableItem,
  MentionOptions,
  MentionProvider,
} from "./mention"
export { filterMentionItems, insertMention } from "./mention"
export { insertTable } from "./table"
export {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE,
  insertUploadedImage,
  uploadImage,
  validateImageFile,
} from "./image-upload"
export {
  AI_WRITE_MERGE_ORIGIN,
  appendTextToBlockSchemaYDoc,
  blockSchemaYDocHasContent,
  createBlockSchemaYDoc,
  documentFromYjs,
  documentFromYjsOrStarter,
  documentToPlainText,
  forkYDoc,
  mergeForkInto,
} from "./yjs-document"
export { collectMentionIds } from "./mention-collect"
export type {
  ImageMimeType,
  ImageUploadConfig,
  ImageUploadHandler,
  ImageUploadResult,
  ImageValidationErrorCode,
  ImageValidationResult,
} from "./image-upload"
export type { CanvasImageFetchHandler } from "./canvas/canvas-files"
export {
  externalizeCanvasFiles,
  inlineRemoteCanvasFiles,
} from "./canvas/canvas-files"
export { exportCanvasToBlob } from "./canvas/canvas-export"
export {
  hasCanvasContent,
  parseCanvasSnapshot,
  stringifyCanvasSnapshot,
  type CanvasSnapshot,
} from "./canvas/canvas-snapshot"
export {
  AI_WRITABLE_BLOCK_TYPES,
  applyAiWriteOp,
  blocksToAiBlockViews,
  collectAiBlockIds,
  collectAiWriteDraftIds,
  // 流式 applier：fork 编辑器消费 tool_partial，避免重复 insert
  createAiWriteStreamApplier,
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
  type AiWritePartialEvent,
  type AiWriteStreamApplier,
  type AiWriteValidationContext,
  type AiWritableBlockType,
} from "./ai-write"
export {
  blocksToHtml,
  blocksToMarkdown,
  markdownToBlocks,
  wrapExportHtmlDocument,
} from "./markdown"

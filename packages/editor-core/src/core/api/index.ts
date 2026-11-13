/**
 * 编辑器程序化 API：块操纵、剪贴板、导入导出。
 * 应用/UI 请用 `BlockEditor` 门面；测试、Agent、无 React 脚本可直接调用此处函数（入参为 Tiptap `Editor`）。
 */
export type { ContainerRef } from "./nodeUtil"
export {
  findContainerAtSelection,
  findContainerById,
  findPreviousSiblingContainer,
  getContainerDepth,
  hasParentContainer,
  insertPosAfterContainer,
  requireNodeType,
} from "./nodeUtil"

export {
  blockToContainerNode,
  normalizePartialBlock,
} from "./conversions/partialBlock"

export { findBlockById } from "./blockManipulation/tree"
export {
  buildNestBlockTransaction,
  buildUnnestBlockTransaction,
  moveContainer,
  nestContainerInPreviousSibling,
  unnestContainer,
  wrapContainerDeeper,
} from "./blockManipulation/nesting"

export { insertBlocks } from "./blockManipulation/commands/insertBlocks"
export { updateBlock } from "./blockManipulation/commands/updateBlock"
export { removeBlocks } from "./blockManipulation/commands/removeBlocks"
export { nestBlock } from "./blockManipulation/commands/nestBlock"
export { unnestBlock } from "./blockManipulation/commands/unnestBlock"

export { getSelectedBlocks } from "./blockManipulation/selections/getSelectedBlocks"
export { getActiveBlockContainerId } from "./blockManipulation/selections/getActiveBlockContainerId"

export { handleMarkdownPaste } from "./clipboard/fromClipboard/handleMarkdownPaste"
export {
  handleTableBlockPaste,
  isSelectionInTableCell,
  parseBlocksFromClipboardText,
} from "./clipboard/fromClipboard/tableBlockPaste"

export { markdownToBlocks } from "./parsers/markdown/parseMarkdown"
export { blocksToMarkdown } from "./exporters/markdown/markdownExporter"
export {
  blocksToHtml,
  wrapExportHtmlDocument,
} from "./exporters/html/htmlExporter"

/**
 * Block[] ↔ ProseMirror 文档；实现位于 schema/convert（依赖 schema registry）。
 * 对外统一从 api/conversions 引用，避免 block-schema 与 schema 双入口。
 */
export {
  blocksToPmDoc,
  pmDocToBlocks,
  blockToContainer,
  blockToContentNode,
  containerToBlock,
  containersToBlocks,
  contentNodeToBlock,
  codeTextPmToBlock,
  inlineBlockToPm,
  inlinePmToBlock,
  marksToStyles,
  stylesToMarks,
  countHeaderRows,
  tablePmToBlock,
  resolveConvertRegistry,
} from "../../schema/convert"

/** 薄 re-export：convert 实现已迁至 schema/convert，保持旧 import 路径兼容 */
export {
  blocksToPmDoc,
  pmDocToBlocks,
  inlinePmToBlock,
  inlineBlockToPm,
  marksToStyles,
  stylesToMarks,
  codeTextPmToBlock,
  tablePmToBlock,
  countHeaderRows,
  requireNodeType,
} from "../schema/convert"

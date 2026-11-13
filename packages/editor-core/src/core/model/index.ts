/** Block JSON 领域模型：与 PM/Tiptap 无关的类型与工厂 */
export type {
  Block,
  BlockType,
  InlineContent,
  InlineStyles,
  PartialBlock,
  TableContent,
} from "./types"
export { MAX_NEST_DEPTH, generateBlockId } from "./ids"
export {
  createEmptyBlocks,
  createStarterBlocks,
  isBlockArray,
} from "./documents"

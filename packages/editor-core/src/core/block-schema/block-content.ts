import type { BlockType } from "./types"
import { DEFAULT_BLOCK_TYPES } from "../schema/default-specs"
import { bulletListItemSpec } from "../schema/default-specs/bullet-list-item"
import { checkListItemSpec } from "../schema/default-specs/check-list-item"
import { dividerSpec } from "../schema/default-specs/divider"
import { headingSpec } from "../schema/default-specs/heading"
import { numberedListItemSpec } from "../schema/default-specs/numbered-list-item"
import { paragraphSpec } from "../schema/default-specs/paragraph"
import { quoteSpec } from "../schema/default-specs/quote"
import {
  CodeBlockContent,
  ImageBlock,
  BlockTable,
  CanvasBlock,
} from "./legacy-complex-blocks"

/** 所有 blockContent 节点名，与 BlockType 一一对应 */
export const BLOCK_CONTENT_NODE_NAMES: BlockType[] = DEFAULT_BLOCK_TYPES

/** 简单块：从 default-specs 导出 Node（P1 迁移） */
export const ParagraphBlock = paragraphSpec.node
export const HeadingBlock = headingSpec.node
export const BulletListItemBlock = bulletListItemSpec.node
export const NumberedListItemBlock = numberedListItemSpec.node
export const CheckListItemBlock = checkListItemSpec.node
export const QuoteBlock = quoteSpec.node
export const DividerBlock = dividerSpec.node

export {
  CodeBlockContent,
  ImageBlock,
  BlockTable,
  CanvasBlock,
} from "./legacy-complex-blocks"

export const blockContentExtensions = [
  ParagraphBlock,
  HeadingBlock,
  BulletListItemBlock,
  NumberedListItemBlock,
  CheckListItemBlock,
  QuoteBlock,
  CodeBlockContent,
  DividerBlock,
  ImageBlock,
  BlockTable,
  CanvasBlock,
]

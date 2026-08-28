import { DEFAULT_BLOCK_TYPES } from "../schema/default-specs"
import { bulletListItemSpec } from "../schema/default-specs/bullet-list-item"
import { canvasSpec } from "../schema/default-specs/canvas"
import { checkListItemSpec } from "../schema/default-specs/check-list-item"
import { codeBlockSpec } from "../schema/default-specs/code-block"
import { dividerSpec } from "../schema/default-specs/divider"
import { headingSpec } from "../schema/default-specs/heading"
import { imageSpec } from "../schema/default-specs/image"
import { numberedListItemSpec } from "../schema/default-specs/numbered-list-item"
import { paragraphSpec } from "../schema/default-specs/paragraph"
import { quoteSpec } from "../schema/default-specs/quote"
import { tableSpec } from "../schema/default-specs/table"
import type { BlockType } from "./types"

/** 所有 blockContent 节点名，与 BlockType 一一对应 */
export const BLOCK_CONTENT_NODE_NAMES: BlockType[] = DEFAULT_BLOCK_TYPES

export const ParagraphBlock = paragraphSpec.node
export const HeadingBlock = headingSpec.node
export const BulletListItemBlock = bulletListItemSpec.node
export const NumberedListItemBlock = numberedListItemSpec.node
export const CheckListItemBlock = checkListItemSpec.node
export const QuoteBlock = quoteSpec.node
export const CodeBlockContent = codeBlockSpec.node
export const DividerBlock = dividerSpec.node
export const ImageBlock = imageSpec.node
export const BlockTable = tableSpec.node
export const CanvasBlock = canvasSpec.node

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

import type { BlockSpec } from "../block-spec"
import { BlockSchemaRegistry } from "../registry"
import { bulletListItemSpec } from "./bullet-list-item"
import { canvasSpec } from "./canvas"
import { checkListItemSpec } from "./check-list-item"
import { codeBlockSpec } from "./code-block"
import { dividerSpec } from "./divider"
import { headingSpec } from "./heading"
import { imageSpec } from "./image"
import { numberedListItemSpec } from "./numbered-list-item"
import { paragraphSpec } from "./paragraph"
import { quoteSpec } from "./quote"
import { tableSpec } from "./table"

/** 全部 11 种内置块 spec */
export const BUILTIN_BLOCK_SPECS: BlockSpec[] = [
  paragraphSpec,
  headingSpec,
  bulletListItemSpec,
  numberedListItemSpec,
  checkListItemSpec,
  quoteSpec,
  codeBlockSpec,
  dividerSpec,
  imageSpec,
  tableSpec,
  canvasSpec,
]

/** 将 Tiptap 扩展包装为 BlockSpec（SDK 自定义块时使用） */
export function blockSpecFromExtension(
  extension: BlockSpec["node"],
  config: BlockSpec["config"]
): BlockSpec {
  return { config, node: extension }
}

/** 内置块 type 顺序，供 block-content 与测试使用 */
export const DEFAULT_BLOCK_TYPES = BUILTIN_BLOCK_SPECS.map(
  (spec) => spec.config.type
) as import("../../block-schema/types").BlockType[]

/** 从 default-specs 构建默认 registry */
export function createDefaultBlockSchemaRegistry(): BlockSchemaRegistry {
  return new BlockSchemaRegistry(BUILTIN_BLOCK_SPECS)
}

export const DEFAULT_BUILTIN_BLOCK_COUNT = BUILTIN_BLOCK_SPECS.length

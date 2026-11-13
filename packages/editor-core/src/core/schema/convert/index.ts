import type { Node as PMNode, Schema } from "@tiptap/pm/model"
import { createEmptyBlocks } from "../../model/documents"
import type { Block } from "../../model/types"
import { createDefaultBlockSchemaRegistry } from "../default-specs"
import type { BlockSchemaRegistry } from "../registry"
import { blockToContainer, containersToBlocks } from "./block"
import { requireNodeType } from "./inline"

/** 默认内置 registry；自定义 schema 时可传入覆盖 */
export function resolveConvertRegistry(
  registry?: BlockSchemaRegistry
): BlockSchemaRegistry {
  return registry ?? createDefaultBlockSchemaRegistry()
}

/** ProseMirror 文档 → Block[] */
export function pmDocToBlocks(
  doc: PMNode,
  registry?: BlockSchemaRegistry
): Block[] {
  const resolved = resolveConvertRegistry(registry)
  const root = doc.firstChild
  if (!root || root.type.name !== "blockGroup") {
    return createEmptyBlocks()
  }

  const blocks = containersToBlocks(root, resolved)
  return blocks.length > 0 ? blocks : createEmptyBlocks()
}

/** Block[] → ProseMirror 文档；空数组时插入 createEmptyBlocks() */
export function blocksToPmDoc(
  blocks: Block[],
  schema: Schema,
  registry?: BlockSchemaRegistry
): PMNode {
  const resolved = resolveConvertRegistry(registry)
  const normalized = blocks.length > 0 ? blocks : createEmptyBlocks()
  const containers = normalized.map((block) =>
    blockToContainer(block, schema, resolved)
  )
  const group = requireNodeType(schema, "blockGroup").create(null, containers)
  return requireNodeType(schema, "doc").create(null, group)
}

export {
  blockToContainer,
  blockToContentNode,
  containerToBlock,
  containersToBlocks,
  contentNodeToBlock,
} from "./block"
export {
  codeTextPmToBlock,
  inlineBlockToPm,
  inlinePmToBlock,
  marksToStyles,
  requireNodeType,
  stylesToMarks,
} from "./inline"
export { countHeaderRows, tablePmToBlock } from "./table"

import type { Node as PMNode, Schema } from "@tiptap/pm/model"
import type {
  Block,
  InlineContent,
  TableContent,
} from "../../block-schema/types"
import type { BlockSpec } from "../block-spec"
import type { BlockSchemaRegistry } from "../registry"
import {
  codeTextPmToBlock,
  inlineBlockToPm,
  inlinePmToBlock,
  requireNodeType,
} from "./inline"
import { tablePmToBlock } from "./table"

/** PM node attrs → Block.props，与 legacy convert 行为一致 */
function nodeAttrsToBlockProps(
  node: PMNode,
  spec: BlockSpec
): Record<string, unknown> {
  const type = spec.config.type

  if (type === "heading") {
    return { level: node.attrs.level }
  }
  if (type === "checkListItem") {
    return { checked: Boolean(node.attrs.checked) }
  }
  if (type === "codeBlock") {
    return {
      language: (node.attrs.language as string | null) ?? null,
    }
  }
  if (type === "image") {
    return {
      src: node.attrs.src ?? null,
      uploadStatus: node.attrs.uploadStatus ?? "idle",
    }
  }
  if (type === "canvas") {
    return {
      canvasId: node.attrs.canvasId ?? null,
      snapshot: node.attrs.snapshot ?? "",
    }
  }
  if (Object.keys(spec.config.propSchema).length === 0) {
    return {}
  }

  const props: Record<string, unknown> = {}
  for (const key of Object.keys(spec.config.propSchema)) {
    props[key] = node.attrs[key]
  }
  return props
}

/** Block.props → PM create attrs */
function blockPropsToNodeAttrs(block: Block, spec: BlockSpec): Record<string, unknown> {
  const type = spec.config.type

  if (type === "heading") {
    return { level: (block.props.level as number) ?? 1 }
  }
  if (type === "checkListItem") {
    return { checked: Boolean(block.props.checked) }
  }
  if (type === "codeBlock") {
    return { language: (block.props.language as string | null) ?? null }
  }
  if (type === "image") {
    return {
      src: (block.props.src as string | null) ?? null,
      uploadStatus: (block.props.uploadStatus as string) ?? "idle",
    }
  }
  if (type === "canvas") {
    return {
      canvasId: (block.props.canvasId as string | null) ?? null,
      snapshot: (block.props.snapshot as string) ?? "",
    }
  }
  if (type === "divider") {
    return {}
  }
  return { ...block.props }
}

/** 未知 blockContent 节点降级为 paragraph，尽量保留可抽取的行内文本 */
function fallbackContentNodeToBlock(
  node: PMNode
): Pick<Block, "type" | "props" | "content"> {
  return {
    type: "paragraph",
    props: {},
    content: inlinePmToBlock(node.content),
  }
}

/** 按 registry spec 的 content 模式将 PM blockContent 转为 Block 字段 */
export function contentNodeToBlock(
  node: PMNode,
  registry: BlockSchemaRegistry
): Pick<Block, "type" | "props" | "content"> {
  const nodeType = node.type.name
  const spec = registry.get(nodeType)

  if (!spec) {
    return fallbackContentNodeToBlock(node)
  }

  if (spec.toBlock) {
    const partial = spec.toBlock({ contentNode: node, blockId: "" })
    if (partial?.type) {
      return {
        type: partial.type,
        props: partial.props ?? {},
        content: partial.content,
      }
    }
  }

  const { config } = spec
  const props = nodeAttrsToBlockProps(node, spec)

  switch (config.content) {
    case "inline":
      return {
        type: config.type,
        props,
        content: inlinePmToBlock(node.content),
      }
    case "text":
      return {
        type: config.type,
        props,
        content: codeTextPmToBlock(node.content),
      }
    case "table":
      return {
        type: config.type,
        props,
        content: tablePmToBlock(node),
      }
    case "none":
      return { type: config.type, props }
    default:
      return fallbackContentNodeToBlock(node)
  }
}

function tableBlockToPm(content: TableContent, schema: Schema): PMNode {
  const rowNodes = content.rows.map((row, rowIndex) => {
    const isHeaderRow = rowIndex < content.headerRows
    const cellNodes = row.cells.map((cell) => {
      const cellType = requireNodeType(
        schema,
        isHeaderRow ? "tableHeader" : "tableCell"
      )
      const paragraph = requireNodeType(schema, "paragraph").create(
        null,
        inlineBlockToPm(cell.content, schema)
      )
      return cellType.create(null, paragraph)
    })
    return requireNodeType(schema, "tableRow").create(null, cellNodes)
  })

  return requireNodeType(schema, "table").create(null, rowNodes)
}

/** Block → PM blockContent 节点；优先使用 spec.fromBlock 钩子 */
export function blockToContentNode(
  block: Block,
  schema: Schema,
  registry: BlockSchemaRegistry
): PMNode {
  const spec = registry.get(block.type)

  if (spec?.fromBlock) {
    return spec.fromBlock(block, schema)
  }

  if (!spec) {
    return requireNodeType(schema, "paragraph").create(
      null,
      inlineBlockToPm(
        Array.isArray(block.content) ? block.content : [],
        schema
      )
    )
  }

  const { config } = spec

  switch (config.content) {
    case "inline":
      return requireNodeType(schema, config.type).create(
        blockPropsToNodeAttrs(block, spec),
        inlineBlockToPm(
          Array.isArray(block.content) ? block.content : [],
          schema
        )
      )
    case "text": {
      const inline = Array.isArray(block.content) ? block.content : []
      const textNodes = inline
        .filter(
          (item): item is Extract<InlineContent, { type: "text" }> =>
            item.type === "text"
        )
        .map((item) => schema.text(item.text))
      return requireNodeType(schema, config.type).create(
        blockPropsToNodeAttrs(block, spec),
        textNodes
      )
    }
    case "table":
      return tableBlockToPm(block.content as TableContent, schema)
    case "none":
      return requireNodeType(schema, config.type).create(
        blockPropsToNodeAttrs(block, spec)
      )
    default:
      return requireNodeType(schema, "paragraph").create(
        null,
        inlineBlockToPm(
          Array.isArray(block.content) ? block.content : [],
          schema
        )
      )
  }
}

export function blockToContainer(
  block: Block,
  schema: Schema,
  registry: BlockSchemaRegistry
): PMNode {
  const contentNode = blockToContentNode(block, schema, registry)
  const children: PMNode[] = [contentNode]

  if (block.children.length > 0) {
    const nested = block.children.map((child) =>
      blockToContainer(child, schema, registry)
    )
    children.push(requireNodeType(schema, "blockGroup").create(null, nested))
  }

  return requireNodeType(schema, "blockContainer").create(
    { id: block.id },
    children
  )
}

export function containerToBlock(
  container: PMNode,
  registry: BlockSchemaRegistry
): Block {
  const contentNode = container.child(0)
  const fields = contentNodeToBlock(contentNode, registry)
  const childGroup = container.childCount > 1 ? container.child(1) : null
  const children =
    childGroup && childGroup.type.name === "blockGroup"
      ? containersToBlocks(childGroup, registry)
      : []

  return {
    id: container.attrs.id as string,
    ...fields,
    children,
  }
}

export function containersToBlocks(
  group: PMNode,
  registry: BlockSchemaRegistry
): Block[] {
  const blocks: Block[] = []
  group.forEach((container) => {
    if (container.type.name === "blockContainer") {
      blocks.push(containerToBlock(container, registry))
    }
  })
  return blocks
}

import type { Mark, Node as PMNode, Schema } from "@tiptap/pm/model"
import { Fragment } from "@tiptap/pm/model"
import { createEmptyBlocks } from "./documents"
import { BLOCK_CONTENT_NODE_NAMES } from "./block-content"
import type {
  Block,
  BlockType,
  InlineContent,
  InlineStyles,
  TableContent,
} from "./types"

const BLOCK_CONTENT_TYPES = new Set<string>(BLOCK_CONTENT_NODE_NAMES)

/** PM marks → Block 行内 styles（不含 link） */
function marksToStyles(marks: readonly Mark[]): InlineStyles {
  const styles: InlineStyles = {}
  for (const mark of marks) {
    switch (mark.type.name) {
      case "bold":
        styles.bold = true
        break
      case "italic":
        styles.italic = true
        break
      case "underline":
        styles.underline = true
        break
      case "strike":
        styles.strike = true
        break
      case "code":
        styles.code = true
        break
    }
  }
  return styles
}

/** Block styles → PM marks */
function stylesToMarks(styles: InlineStyles, schema: Schema): Mark[] {
  const marks: Mark[] = []
  if (styles.bold && schema.marks.bold) {
    marks.push(schema.marks.bold.create())
  }
  if (styles.italic && schema.marks.italic) {
    marks.push(schema.marks.italic.create())
  }
  if (styles.underline && schema.marks.underline) {
    marks.push(schema.marks.underline.create())
  }
  if (styles.strike && schema.marks.strike) {
    marks.push(schema.marks.strike.create())
  }
  if (styles.code && schema.marks.code) {
    marks.push(schema.marks.code.create())
  }
  return marks
}

function textNodeToInline(node: PMNode): InlineContent[] {
  const text = node.text ?? ""
  if (!text) {
    return []
  }

  const linkMark = node.marks.find((mark) => mark.type.name === "link")
  const styles = marksToStyles(
    node.marks.filter((mark) => mark.type.name !== "link")
  )

  if (linkMark) {
    return [
      {
        type: "link",
        href: (linkMark.attrs.href as string) ?? "",
        content: [{ type: "text", text, styles }],
      },
    ]
  }

  return [{ type: "text", text, styles }]
}

/** 将 PM 行内片段转为 Block InlineContent[] */
function inlinePmToBlock(fragment: Fragment): InlineContent[] {
  const result: InlineContent[] = []

  fragment.forEach((node) => {
    if (node.isText) {
      result.push(...textNodeToInline(node))
      return
    }

    if (node.type.name === "mention") {
      result.push({
        type: "mention",
        id: (node.attrs.id as string) ?? "",
        label: (node.attrs.label as string) ?? (node.attrs.id as string) ?? "",
        href: (node.attrs.href as string) ?? "",
      })
      return
    }

    // hardBreak 等其它 inline 节点压成换行文本
    if (node.type.name === "hardBreak") {
      result.push({ type: "text", text: "\n", styles: {} })
    }
  })

  return result
}

/** codeBlock 的 text* 内容 → 无样式行内数组 */
function codeTextPmToBlock(fragment: Fragment): InlineContent[] {
  const parts: string[] = []
  fragment.forEach((node) => {
    if (node.isText && node.text) {
      parts.push(node.text)
    }
  })
  const text = parts.join("")
  return text ? [{ type: "text", text, styles: {} }] : []
}

function countHeaderRows(tableNode: PMNode): number {
  let headerRows = 0
  for (let index = 0; index < tableNode.childCount; index += 1) {
    const row = tableNode.child(index)
    const allHeader =
      row.childCount > 0 &&
      Array.from({ length: row.childCount }).every(
        (_, cellIndex) => row.child(cellIndex).type.name === "tableHeader"
      )
    if (allHeader) {
      headerRows += 1
    } else {
      break
    }
  }
  return headerRows
}

function tablePmToBlock(tableNode: PMNode): TableContent {
  const rows: TableContent["rows"] = []

  tableNode.forEach((rowNode) => {
    const cells: { content: InlineContent[] }[] = []
    rowNode.forEach((cellNode) => {
      // 单元格内通常是 paragraph 包裹的行内
      const inlineParts: InlineContent[] = []
      cellNode.forEach((block) => {
        inlineParts.push(...inlinePmToBlock(block.content))
      })
      cells.push({ content: inlineParts })
    })
    rows.push({ cells })
  })

  return {
    headerRows: countHeaderRows(tableNode),
    rows,
  }
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

function contentNodeToBlock(
  node: PMNode
): Pick<Block, "type" | "props" | "content"> {
  const nodeType = node.type.name

  if (!BLOCK_CONTENT_TYPES.has(nodeType)) {
    return fallbackContentNodeToBlock(node)
  }

  switch (nodeType as BlockType) {
    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "quote":
      return {
        type: nodeType,
        props: {},
        content: inlinePmToBlock(node.content),
      }
    case "heading":
      return {
        type: "heading",
        props: { level: node.attrs.level },
        content: inlinePmToBlock(node.content),
      }
    case "checkListItem":
      return {
        type: "checkListItem",
        props: { checked: Boolean(node.attrs.checked) },
        content: inlinePmToBlock(node.content),
      }
    case "codeBlock":
      return {
        type: "codeBlock",
        props: {
          language: (node.attrs.language as string | null) ?? null,
        },
        content: codeTextPmToBlock(node.content),
      }
    case "divider":
      return { type: "divider", props: {} }
    case "image":
      return {
        type: "image",
        props: {
          src: node.attrs.src ?? null,
          uploadStatus: node.attrs.uploadStatus ?? "idle",
        },
      }
    case "table":
      return {
        type: "table",
        props: {},
        content: tablePmToBlock(node),
      }
    case "canvas":
      return {
        type: "canvas",
        props: {
          canvasId: node.attrs.canvasId ?? null,
          snapshot: node.attrs.snapshot ?? "",
        },
      }
    default:
      return fallbackContentNodeToBlock(node)
  }
}

function containerToBlock(container: PMNode): Block {
  const contentNode = container.child(0)
  const fields = contentNodeToBlock(contentNode)
  const childGroup = container.childCount > 1 ? container.child(1) : null
  const children =
    childGroup && childGroup.type.name === "blockGroup"
      ? containersToBlocks(childGroup)
      : []

  return {
    id: container.attrs.id as string,
    ...fields,
    children,
  }
}

function containersToBlocks(group: PMNode): Block[] {
  const blocks: Block[] = []
  group.forEach((container) => {
    if (container.type.name === "blockContainer") {
      blocks.push(containerToBlock(container))
    }
  })
  return blocks
}

/** ProseMirror 文档 → Block[] */
export function pmDocToBlocks(doc: PMNode): Block[] {
  const root = doc.firstChild
  if (!root || root.type.name !== "blockGroup") {
    return createEmptyBlocks()
  }

  const blocks = containersToBlocks(root)
  return blocks.length > 0 ? blocks : createEmptyBlocks()
}

function inlineBlockToPm(inline: InlineContent[], schema: Schema): PMNode[] {
  const nodes: PMNode[] = []

  for (const item of inline) {
    if (item.type === "text") {
      if (item.text) {
        nodes.push(schema.text(item.text, stylesToMarks(item.styles, schema)))
      }
      continue
    }

    if (item.type === "link") {
      const linkMark = schema.marks.link.create({ href: item.href })
      for (const child of item.content) {
        if (child.type === "text" && child.text) {
          nodes.push(
            schema.text(child.text, [
              ...stylesToMarks(child.styles, schema),
              linkMark,
            ])
          )
        }
      }
      continue
    }

    if (item.type === "mention") {
      nodes.push(
        schema.nodes.mention.create({
          id: item.id,
          label: item.label,
          href: item.href,
        })
      )
    }
  }

  return nodes
}

function tableBlockToPm(content: TableContent, schema: Schema): PMNode {
  const rowNodes = content.rows.map((row, rowIndex) => {
    const isHeaderRow = rowIndex < content.headerRows
    const cellNodes = row.cells.map((cell) => {
      const cellType = isHeaderRow
        ? schema.nodes.tableHeader
        : schema.nodes.tableCell
      const paragraph = schema.nodes.paragraph.create(
        null,
        inlineBlockToPm(cell.content, schema)
      )
      return cellType.create(null, paragraph)
    })
    return schema.nodes.tableRow.create(null, cellNodes)
  })

  return schema.nodes.table.create(null, rowNodes)
}

function blockToContentNode(block: Block, schema: Schema): PMNode {
  switch (block.type) {
    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "quote":
      return schema.nodes[block.type].create(
        null,
        inlineBlockToPm(
          Array.isArray(block.content) ? block.content : [],
          schema
        )
      )
    case "heading":
      return schema.nodes.heading.create(
        { level: (block.props.level as number) ?? 1 },
        inlineBlockToPm(
          Array.isArray(block.content) ? block.content : [],
          schema
        )
      )
    case "checkListItem":
      return schema.nodes.checkListItem.create(
        { checked: Boolean(block.props.checked) },
        inlineBlockToPm(
          Array.isArray(block.content) ? block.content : [],
          schema
        )
      )
    case "codeBlock": {
      const textNodes = (Array.isArray(block.content) ? block.content : [])
        .filter(
          (item): item is Extract<InlineContent, { type: "text" }> =>
            item.type === "text"
        )
        .map((item) => schema.text(item.text))
      return schema.nodes.codeBlock.create(
        { language: (block.props.language as string | null) ?? null },
        textNodes
      )
    }
    case "divider":
      return schema.nodes.divider.create()
    case "image":
      return schema.nodes.image.create({
        src: (block.props.src as string | null) ?? null,
        uploadStatus: (block.props.uploadStatus as string) ?? "idle",
      })
    case "table":
      return tableBlockToPm(block.content as TableContent, schema)
    case "canvas":
      return schema.nodes.canvas.create({
        canvasId: (block.props.canvasId as string | null) ?? null,
        snapshot: (block.props.snapshot as string) ?? "",
      })
    default:
      return schema.nodes.paragraph.create(
        null,
        inlineBlockToPm(
          Array.isArray(block.content) ? block.content : [],
          schema
        )
      )
  }
}

function blockToContainer(block: Block, schema: Schema): PMNode {
  const contentNode = blockToContentNode(block, schema)
  const children: PMNode[] = [contentNode]

  if (block.children.length > 0) {
    const nested = block.children.map((child) =>
      blockToContainer(child, schema)
    )
    children.push(schema.nodes.blockGroup.create(null, nested))
  }

  return schema.nodes.blockContainer.create({ id: block.id }, children)
}

/** Block[] → ProseMirror 文档；空数组时插入 createEmptyBlocks() */
export function blocksToPmDoc(blocks: Block[], schema: Schema): PMNode {
  const normalized = blocks.length > 0 ? blocks : createEmptyBlocks()
  const containers = normalized.map((block) => blockToContainer(block, schema))
  const group = schema.nodes.blockGroup.create(null, containers)
  return schema.nodes.doc.create(null, group)
}

import { createEmptyBlocks } from "../block-schema/documents"
import { generateBlockId } from "../block-schema/ids"
import type {
  Block,
  BlockType,
  InlineContent,
  InlineStyles,
  TableContent,
} from "../block-schema/types"

/** 旧 Tiptap JSON 节点（纯数据，不依赖 Editor） */
type LegacyMark = {
  type: string
  attrs?: Record<string, unknown>
}

type LegacyNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: LegacyNode[]
  text?: string
  marks?: LegacyMark[]
}

type ListBlockType = "bulletListItem" | "numberedListItem" | "checkListItem"

function createBlockWithId(
  type: BlockType,
  options: {
    props?: Record<string, unknown>
    content?: InlineContent[] | TableContent
    children?: Block[]
  } = {}
): Block {
  return {
    id: generateBlockId(),
    type,
    props: options.props ?? {},
    content: options.content,
    children: options.children ?? [],
  }
}

/** Tiptap marks → Block 行内 styles（link 单独处理） */
function marksToStyles(marks: LegacyMark[]): InlineStyles {
  const styles: InlineStyles = {}
  for (const mark of marks) {
    switch (mark.type) {
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

function textNodeToInline(node: LegacyNode): InlineContent[] {
  const text = node.text ?? ""
  if (!text) {
    return []
  }

  const marks = node.marks ?? []
  const linkMark = marks.find((mark) => mark.type === "link")
  const styles = marksToStyles(marks.filter((mark) => mark.type !== "link"))

  if (linkMark) {
    return [
      {
        type: "link",
        href: (linkMark.attrs?.href as string) ?? "",
        content: [{ type: "text", text, styles }],
      },
    ]
  }

  return [{ type: "text", text, styles }]
}

/** 段落/标题等节点的行内 content 数组 */
function convertInlineContent(nodes: LegacyNode[]): InlineContent[] {
  const result: InlineContent[] = []

  for (const node of nodes) {
    if (node.type === "text") {
      result.push(...textNodeToInline(node))
      continue
    }

    if (node.type === "mention") {
      result.push({
        type: "mention",
        id: (node.attrs?.id as string) ?? "",
        label:
          (node.attrs?.label as string) ?? (node.attrs?.id as string) ?? "",
        href: (node.attrs?.href as string) ?? "",
      })
      continue
    }

    // hardBreak 等其它 inline 压成换行
    if (node.type === "hardBreak") {
      result.push({ type: "text", text: "\n", styles: {} })
    }
  }

  return result
}

/** codeBlock 的 text* 内容 → 无样式纯文本行内 */
function convertCodeBlockContent(nodes: LegacyNode[]): InlineContent[] {
  const parts: string[] = []
  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      parts.push(node.text)
    }
  }
  const text = parts.join("")
  return text ? [{ type: "text", text, styles: {} }] : []
}

function countHeaderRows(rowNodes: LegacyNode[]): number {
  if (rowNodes.length === 0) {
    return 0
  }

  const firstRow = rowNodes[0]
  const cells = firstRow?.content ?? []
  const allHeader =
    cells.length > 0 && cells.every((cell) => cell.type === "tableHeader")

  return allHeader ? 1 : 0
}

function convertTable(node: LegacyNode): Block {
  const rowNodes = (node.content ?? []).filter(
    (child) => child.type === "tableRow"
  )
  const rows: TableContent["rows"] = []

  for (const rowNode of rowNodes) {
    const cells: { content: InlineContent[] }[] = []
    for (const cellNode of rowNode.content ?? []) {
      const inlineParts: InlineContent[] = []
      // 单元格内通常是 paragraph 包裹的行内
      for (const block of cellNode.content ?? []) {
        inlineParts.push(...convertInlineContent(block.content ?? []))
      }
      cells.push({ content: inlineParts })
    }
    rows.push({ cells })
  }

  return createBlockWithId("table", {
    content: {
      headerRows: countHeaderRows(rowNodes),
      rows,
    },
  })
}

function convertBlockquote(node: LegacyNode): Block {
  const nodes = node.content ?? []
  let quoteContent: InlineContent[] = []
  const children: Block[] = []
  let firstParagraphHandled = false

  for (const child of nodes) {
    if (!firstParagraphHandled && child.type === "paragraph") {
      quoteContent = convertInlineContent(child.content ?? [])
      firstParagraphHandled = true
      continue
    }

    // 首段之后的内部节点递归为 quote.children
    children.push(...convertTopLevelNodes([child]))
  }

  return createBlockWithId("quote", {
    content: quoteContent,
    children,
  })
}

/** 单个 listItem/taskItem：首段 → content，嵌套 list → children */
function convertListItem(
  item: LegacyNode,
  blockType: ListBlockType,
  checked?: boolean
): Block {
  const itemContent = item.content ?? []
  let inlineContent: InlineContent[] = []
  const children: Block[] = []
  let firstParagraphHandled = false

  for (const child of itemContent) {
    if (!firstParagraphHandled && child.type === "paragraph") {
      inlineContent = convertInlineContent(child.content ?? [])
      firstParagraphHandled = true
      continue
    }

    if (
      child.type === "bulletList" ||
      child.type === "orderedList" ||
      child.type === "taskList"
    ) {
      children.push(...convertList(child))
      continue
    }

    // 非首段、非嵌套 list 的节点作为子块保留
    children.push(...convertTopLevelNodes([child]))
  }

  return createBlockWithId(blockType, {
    props: blockType === "checkListItem" ? { checked: Boolean(checked) } : {},
    content: inlineContent,
    children,
  })
}

function convertList(node: LegacyNode): Block[] {
  switch (node.type) {
    case "bulletList":
      return (node.content ?? [])
        .filter((item) => item.type === "listItem")
        .map((item) => convertListItem(item, "bulletListItem"))
    case "orderedList":
      return (node.content ?? [])
        .filter((item) => item.type === "listItem")
        .map((item) => convertListItem(item, "numberedListItem"))
    case "taskList":
      return (node.content ?? [])
        .filter((item) => item.type === "taskItem")
        .map((item) =>
          convertListItem(item, "checkListItem", Boolean(item.attrs?.checked))
        )
    default:
      return []
  }
}

/** 未知块节点：尽量抽取嵌套 paragraph 的行内文本 */
function extractInlineFromUnknown(node: LegacyNode): InlineContent[] {
  const inlineParts: InlineContent[] = []
  for (const child of node.content ?? []) {
    if (child.type === "paragraph") {
      inlineParts.push(...convertInlineContent(child.content ?? []))
    }
  }
  return inlineParts
}

function convertTopLevelNode(node: LegacyNode): Block[] {
  switch (node.type) {
    case "paragraph":
      return [
        createBlockWithId("paragraph", {
          content: convertInlineContent(node.content ?? []),
        }),
      ]
    case "heading":
      return [
        createBlockWithId("heading", {
          props: { level: (node.attrs?.level as number) ?? 1 },
          content: convertInlineContent(node.content ?? []),
        }),
      ]
    case "codeBlock":
      return [
        createBlockWithId("codeBlock", {
          props: {
            language: (node.attrs?.language as string | null) ?? null,
          },
          content: convertCodeBlockContent(node.content ?? []),
        }),
      ]
    case "horizontalRule":
      return [createBlockWithId("divider")]
    case "image":
      return [
        createBlockWithId("image", {
          props: {
            src: node.attrs?.src ?? null,
            uploadStatus: node.attrs?.uploadStatus ?? "idle",
          },
        }),
      ]
    case "canvasBlock":
      return [
        createBlockWithId("canvas", {
          props: {
            canvasId: node.attrs?.canvasId ?? null,
            snapshot: node.attrs?.snapshot ?? "",
          },
        }),
      ]
    case "imageUpload":
      return [
        createBlockWithId("image", {
          props: { uploadStatus: "idle" },
        }),
      ]
    case "bulletList":
    case "orderedList":
    case "taskList":
      return convertList(node)
    case "blockquote":
      return [convertBlockquote(node)]
    case "table":
      return [convertTable(node)]
    default:
      return [
        createBlockWithId("paragraph", {
          content: extractInlineFromUnknown(node),
        }),
      ]
  }
}

function convertTopLevelNodes(nodes: unknown[]): Block[] {
  const blocks: Block[] = []
  for (const raw of nodes) {
    if (typeof raw !== "object" || raw === null) {
      continue
    }
    blocks.push(...convertTopLevelNode(raw as LegacyNode))
  }
  return blocks
}

/**
 * 将旧 StarterKit 风格的 Tiptap JSON 文档转为 Block[]。
 * 纯 JSON 遍历，不实例化 Tiptap Editor；每个输出块分配新 UUID。
 */
export function legacyJsonToBlocks(doc: {
  type?: string
  content?: unknown[]
}): Block[] {
  const content = doc.content
  if (!content || content.length === 0) {
    return createEmptyBlocks()
  }

  const blocks = convertTopLevelNodes(content)
  return blocks.length > 0 ? blocks : createEmptyBlocks()
}

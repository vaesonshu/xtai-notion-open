import { generateBlockId } from "../block-schema/ids"
import { createEmptyBlocks } from "../block-schema/documents"
import type {
  Block,
  InlineContent,
  InlineStyles,
  TableContent,
} from "../block-schema/types"

function textContent(text: string, styles: InlineStyles = {}): InlineContent[] {
  if (!text) return []
  return [{ type: "text", text, styles }]
}

function createBlock(
  type: Block["type"],
  options: {
    props?: Record<string, unknown>
    content?: InlineContent[] | TableContent
  } = {}
): Block {
  return {
    id: generateBlockId(),
    type,
    props: options.props ?? {},
    content: options.content,
    children: [],
  }
}

/** 解析行内 **bold** *italic* `code` [text](url) 及组合形式 */
function parseInline(text: string): InlineContent[] {
  if (!text) return []

  const pieces: InlineContent[] = []
  // 链接与加粗链接优先于单独的 **，避免 **[Tiptap](url)** 被当成纯文本
  const pattern =
    /\*\*\[([^\]]+)\]\(([^)]+)\)\*\*|\*\[([^\]]+)\]\(([^)]+)\)\*|\[([^\]]+)\]\(([^)]+)\)|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pieces.push(...textContent(text.slice(lastIndex, match.index)))
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      pieces.push({
        type: "link",
        href: match[2],
        content: textContent(match[1], { bold: true }),
      })
    } else if (match[3] !== undefined && match[4] !== undefined) {
      pieces.push({
        type: "link",
        href: match[4],
        content: textContent(match[3], { italic: true }),
      })
    } else if (match[5] !== undefined && match[6] !== undefined) {
      pieces.push({
        type: "link",
        href: match[6],
        content: parseInline(match[5]),
      })
    } else if (match[7] !== undefined) {
      pieces.push(...textContent(match[7], { bold: true, italic: true }))
    } else if (match[8] !== undefined) {
      pieces.push(...textContent(match[8], { bold: true }))
    } else if (match[9] !== undefined) {
      pieces.push(...textContent(match[9], { italic: true }))
    } else if (match[10] !== undefined) {
      pieces.push(...textContent(match[10], { code: true }))
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    pieces.push(...textContent(text.slice(lastIndex)))
  }

  return pieces.length > 0 ? pieces : textContent(text)
}

function isTableRowLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2
}

function parseTableCells(line: string): string[] {
  const trimmed = line.trim()
  if (!isTableRowLine(trimmed)) return []
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim())
}

function isTableSeparatorLine(line: string): boolean {
  const cells = parseTableCells(line)
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  )
}

/** 解析 GFM 管道表格：表头 + 分隔行 + 若干数据行 */
function tryParseTable(
  lines: string[],
  startIndex: number
): { block: Block; consumed: number } | null {
  const headerLine = lines[startIndex] ?? ""
  const separatorLine = lines[startIndex + 1] ?? ""
  if (!isTableRowLine(headerLine) || !isTableSeparatorLine(separatorLine)) {
    return null
  }

  const columnCount = parseTableCells(headerLine).length
  if (columnCount === 0) {
    return null
  }

  const normalizeCells = (rawLine: string) => {
    const cells = parseTableCells(rawLine)
    return Array.from({ length: columnCount }, (_, index) => cells[index] ?? "")
  }

  const rows: TableContent["rows"] = [
    {
      cells: normalizeCells(headerLine).map((cell) => ({
        content: parseInline(cell),
      })),
    },
  ]

  let index = startIndex + 2
  while (index < lines.length && isTableRowLine(lines[index] ?? "")) {
    if (isTableSeparatorLine(lines[index] ?? "")) {
      break
    }
    rows.push({
      cells: normalizeCells(lines[index] ?? "").map((cell) => ({
        content: parseInline(cell),
      })),
    })
    index += 1
  }

  if (rows.length < 2) {
    return null
  }

  return {
    block: createBlock("table", {
      content: {
        headerRows: 1,
        rows,
      },
    }),
    consumed: index - startIndex,
  }
}

/** 将 Markdown 文本解析为 Block[]（覆盖常见块类型与 GFM 表格） */
export function markdownToBlocks(markdown: string): Block[] {
  const normalized = markdown.replace(/\r\n/g, "\n")
  const lines = normalized.split("\n")
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ""

    if (line.startsWith("```")) {
      const language = line.slice(3).trim()
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        codeLines.push(lines[index] ?? "")
        index += 1
      }
      index += 1
      blocks.push(
        createBlock("codeBlock", {
          props: { language },
          content: textContent(codeLines.join("\n")),
        })
      )
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading?.[1] && heading[2]) {
      blocks.push(
        createBlock("heading", {
          props: { level: heading[1].length },
          content: parseInline(heading[2]),
        })
      )
      index += 1
      continue
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push(createBlock("divider", {}))
      index += 1
      continue
    }

    const checklist = line.match(/^- \[([ xX])\]\s+(.+)$/)
    if (checklist?.[1] && checklist[2]) {
      blocks.push(
        createBlock("checkListItem", {
          props: { checked: checklist[1].toLowerCase() === "x" },
          content: parseInline(checklist[2]),
        })
      )
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      blocks.push(
        createBlock("bulletListItem", {
          content: parseInline(line.replace(/^[-*]\s+/, "")),
        })
      )
      index += 1
      continue
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/)
    if (numbered?.[1]) {
      blocks.push(
        createBlock("numberedListItem", {
          content: parseInline(numbered[1]),
        })
      )
      index += 1
      continue
    }

    if (line.startsWith("> ")) {
      blocks.push(
        createBlock("quote", {
          content: parseInline(line.slice(2)),
        })
      )
      index += 1
      continue
    }

    const image = line.match(/^!\[.*?\]\((.+)\)$/)
    if (image) {
      blocks.push(
        createBlock("image", {
          props: { src: image[1], uploadStatus: "idle" },
        })
      )
      index += 1
      continue
    }

    const table = tryParseTable(lines, index)
    if (table) {
      blocks.push(table.block)
      index += table.consumed
      continue
    }

    if (!line.trim()) {
      index += 1
      continue
    }

    blocks.push(
      createBlock("paragraph", {
        content: parseInline(line),
      })
    )
    index += 1
  }

  return blocks.length > 0 ? blocks : createEmptyBlocks()
}

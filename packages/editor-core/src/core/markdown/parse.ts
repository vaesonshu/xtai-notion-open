import { generateBlockId } from "../block-schema/ids"
import { createEmptyBlocks } from "../block-schema/documents"
import type { Block, InlineContent, InlineStyles } from "../block-schema/types"

function textContent(text: string, styles: InlineStyles = {}): InlineContent[] {
  if (!text) return []
  return [{ type: "text", text, styles }]
}

function createBlock(
  type: Block["type"],
  options: {
    props?: Record<string, unknown>
    content?: InlineContent[]
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

/** 解析行内 **bold** *italic* `code` 为 InlineContent */
function parseInline(text: string): InlineContent[] {
  if (!text) return []
  // 简化实现：暂不拆分混排样式，整段作为纯文本
  return textContent(text)
}

/** 将 Markdown 文本解析为 Block[]（覆盖常见块类型，复杂表格/嵌套后续扩展） */
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

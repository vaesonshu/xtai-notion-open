import { generateBlockId } from "../block-schema/ids"
import type { Block, InlineContent } from "../block-schema/types"

/** 行内纯文本 → Markdown（粗体/斜体/代码） */
function inlineToMarkdown(content: InlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === "mention") {
        return `@${item.label || item.id}`
      }
      if (item.type === "link") {
        const inner = inlineToMarkdown(item.content)
        return inner ? `[${inner}](${item.href})` : item.href
      }
      let text = item.text
      if (item.styles.code) text = `\`${text}\``
      if (item.styles.bold && item.styles.italic) text = `***${text}***`
      else if (item.styles.bold) text = `**${text}**`
      else if (item.styles.italic) text = `*${text}*`
      return text
    })
    .join("")
}

function blockText(block: Block): string {
  if (!Array.isArray(block.content)) return ""
  return inlineToMarkdown(block.content)
}

/** 将 Block[] 导出为 Markdown 文本（表格/画板等复杂块降级为占位） */
export function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = []

  const visit = (items: Block[]) => {
    for (const block of items) {
      switch (block.type) {
        case "heading": {
          const level = Math.min(3, Math.max(1, Number(block.props.level) || 1))
          lines.push(`${"#".repeat(level)} ${blockText(block)}`)
          break
        }
        case "paragraph":
          if (blockText(block)) lines.push(blockText(block))
          break
        case "bulletListItem":
          lines.push(`- ${blockText(block)}`)
          break
        case "numberedListItem":
          lines.push(`1. ${blockText(block)}`)
          break
        case "checkListItem":
          lines.push(
            `- [${block.props.checked ? "x" : " "}] ${blockText(block)}`
          )
          break
        case "quote":
          lines.push(`> ${blockText(block)}`)
          break
        case "codeBlock":
          lines.push(
            "```" +
              String(block.props.language ?? "") +
              "\n" +
              blockText(block) +
              "\n```"
          )
          break
        case "divider":
          lines.push("---")
          break
        case "image": {
          const src = String(block.props.src ?? "")
          lines.push(src ? `![image](${src})` : "<!-- image -->")
          break
        }
        case "table":
          lines.push("<!-- table: export as plain text in future -->")
          break
        case "canvas":
          lines.push("<!-- canvas -->")
          break
        default:
          if (blockText(block)) lines.push(blockText(block))
      }
      if (block.children.length > 0) {
        visit(block.children)
      }
      lines.push("")
    }
  }

  visit(blocks)
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

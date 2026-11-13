import type { Block, InlineContent, TableContent } from "../../../model/types"

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 行内内容 → 安全 HTML 片段 */
function inlineToHtml(content: InlineContent[]): string {
  return content
    .map((item) => {
      if (item.type === "mention") {
        return `<span class="mention">@${escapeHtml(item.label || item.id)}</span>`
      }
      if (item.type === "link") {
        const inner = inlineToHtml(item.content)
        const label = inner || escapeHtml(item.href)
        return `<a href="${escapeHtml(item.href)}">${label}</a>`
      }
      let html = escapeHtml(item.text)
      if (item.styles.code) html = `<code>${html}</code>`
      if (item.styles.strike) html = `<del>${html}</del>`
      if (item.styles.underline) html = `<u>${html}</u>`
      if (item.styles.bold) html = `<strong>${html}</strong>`
      if (item.styles.italic) html = `<em>${html}</em>`
      if (item.styles.color) {
        html = `<span style="color:${escapeHtml(item.styles.color)}">${html}</span>`
      }
      return html
    })
    .join("")
}

function blockInlineHtml(block: Block): string {
  if (!Array.isArray(block.content)) return ""
  return inlineToHtml(block.content)
}

function tableToHtml(content: TableContent): string {
  if (!content.rows.length) return ""

  const rows = content.rows.map((row) => {
    const cells = row.cells
      .map((cell) => `<td>${inlineToHtml(cell.content)}</td>`)
      .join("")
    return `<tr>${cells}</tr>`
  })

  return `<table><tbody>${rows.join("")}</tbody></table>`
}

/** 将 Block[] 导出为 HTML 片段（不含 html/head/body） */
export function blocksToHtml(blocks: Block[]): string {
  const parts: string[] = []

  const visit = (items: Block[]) => {
    for (const block of items) {
      switch (block.type) {
        case "heading": {
          const level = Math.min(3, Math.max(1, Number(block.props.level) || 1))
          parts.push(`<h${level}>${blockInlineHtml(block)}</h${level}>`)
          break
        }
        case "paragraph": {
          const inner = blockInlineHtml(block)
          if (inner) parts.push(`<p>${inner}</p>`)
          break
        }
        case "bulletListItem":
          parts.push(`<ul><li>${blockInlineHtml(block)}</li></ul>`)
          break
        case "numberedListItem":
          parts.push(`<ol><li>${blockInlineHtml(block)}</li></ol>`)
          break
        case "checkListItem":
          parts.push(
            `<ul class="checklist"><li><input type="checkbox" disabled${
              block.props.checked ? " checked" : ""
            } /> ${blockInlineHtml(block)}</li></ul>`
          )
          break
        case "quote":
          parts.push(`<blockquote>${blockInlineHtml(block)}</blockquote>`)
          break
        case "codeBlock": {
          const lang = String(block.props.language ?? "")
          const raw =
            Array.isArray(block.content) &&
            block.content
              .map((item) => (item.type === "text" ? item.text : ""))
              .join("")
          const code = escapeHtml(raw || "")
          parts.push(
            `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${code}</code></pre>`
          )
          break
        }
        case "divider":
          parts.push("<hr />")
          break
        case "image": {
          const src = String(block.props.src ?? "")
          if (src) {
            parts.push(
              `<figure><img src="${escapeHtml(src)}" alt="" /></figure>`
            )
          } else {
            parts.push("<p><em>[image]</em></p>")
          }
          break
        }
        case "table":
          if (block.content && "rows" in block.content) {
            parts.push(tableToHtml(block.content as TableContent))
          }
          break
        case "canvas":
          parts.push("<p><em>[Excalidraw canvas]</em></p>")
          break
        default: {
          const inner = blockInlineHtml(block)
          if (inner) parts.push(`<p>${inner}</p>`)
        }
      }
      if (block.children.length > 0) {
        visit(block.children)
      }
    }
  }

  visit(blocks)
  return parts.join("\n")
}

const EXPORT_PRINT_STYLES = `
  body { font-family: system-ui, sans-serif; line-height: 1.6; color: #242321; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1,h2,h3 { line-height: 1.25; }
  pre { background: #f3f2ef; padding: 0.75rem 1rem; overflow-x: auto; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  td, th { border: 1px solid #eceae4; padding: 0.35rem 0.6rem; vertical-align: top; }
  blockquote { border-left: 3px solid #eceae4; margin: 0; padding-left: 1rem; color: #615e58; }
  img { max-width: 100%; height: auto; }
  ul.checklist { list-style: none; padding-left: 0; }
`

/** 包装完整 HTML 文档，供下载或浏览器打印为 PDF */
export function wrapExportHtmlDocument(
  title: string,
  bodyHtml: string
): string {
  const safeTitle = escapeHtml(title.trim() || "document")
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${EXPORT_PRINT_STYLES}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

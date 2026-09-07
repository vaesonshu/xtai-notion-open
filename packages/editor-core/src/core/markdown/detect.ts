/** 行首是否像 Markdown 块前缀（不含单独的 **bold** 行） */
const MARKDOWN_LINE = /^(#{1,3}\s|[-*]\s|\d+\.\s|>\s|-{3,}\s*$|- \[[ xX]\]\s)/

export function looksLikeMarkdown(text: string): boolean {
  if (text.includes("```")) {
    return true
  }
  return text.split(/\r?\n/).some((line) => MARKDOWN_LINE.test(line))
}

/** Word / 网页富文本粘贴应走 HTML，而不是 Markdown 解析 */
export function clipboardHtmlHasRichStructure(html: string): boolean {
  if (!html.trim()) {
    return false
  }
  return /<(h[1-6]|ul|ol|table|blockquote|strong|em|b|i)\b/i.test(html)
}

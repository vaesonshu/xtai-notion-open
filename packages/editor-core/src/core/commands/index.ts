import type { Editor } from "@tiptap/core"

export type InlineMark = "bold" | "italic" | "underline" | "strike" | "code"

export function toggleInlineMark(editor: Editor, mark: InlineMark): boolean {
  return editor.chain().focus().toggleMark(mark).run()
}

/** 补全常见省略协议的链接地址，便于 autolink 与手动输入一致 */
export function normalizeLinkHref(href: string): string {
  const trimmed = href.trim()
  if (!trimmed) {
    return ""
  }

  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

export function setEditorLink(editor: Editor, href: string): boolean {
  const normalized = normalizeLinkHref(href)
  if (!normalized) {
    return editor.chain().focus().unsetLink().run()
  }

  return editor
    .chain()
    .focus()
    .setLink({ href: normalized })
    .setMeta("preventAutolink", true)
    .run()
}

/** 将用户输入规范化为 #RRGGBB，无法解析时返回 null */
export function normalizeTextColorInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!hexMatch) {
    return null
  }

  const raw = hexMatch[1]!.toUpperCase()
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`
  }

  return `#${raw}`
}

export function setTextColor(
  editor: Editor,
  color: string,
  options?: { focus?: boolean }
): boolean {
  const normalized = normalizeTextColorInput(color)
  if (!normalized) {
    return false
  }

  const chain = editor.chain()
  if (options?.focus !== false) {
    chain.focus()
  }

  return chain.setColor(normalized).run()
}

export function unsetTextColor(
  editor: Editor,
  options?: { focus?: boolean }
): boolean {
  const chain = editor.chain()
  if (options?.focus !== false) {
    chain.focus()
  }

  return chain.unsetColor().run()
}

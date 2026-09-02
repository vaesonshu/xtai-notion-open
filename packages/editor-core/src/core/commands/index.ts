import type { Editor } from "@tiptap/core"

export type InlineMark = "bold" | "italic" | "underline" | "strike" | "code"

export function toggleInlineMark(editor: Editor, mark: InlineMark): boolean {
  return editor.chain().focus().toggleMark(mark).run()
}

export function setEditorLink(editor: Editor, href: string): boolean {
  const chain = editor.chain().focus()
  return href.trim() ? chain.setLink({ href }).run() : chain.unsetLink().run()
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

import type { Editor } from "@tiptap/core"

export type SlashCommand = {
  id: string
  label: string
  keywords: string[]
}

export const UPLOAD_IMAGE_SLASH_COMMAND: SlashCommand = {
  id: "upload-image",
  label: "上传图片",
  keywords: ["upload-image", "image", "图片"],
}

export function getSlashCommands({
  includeImageUpload = false,
}: {
  includeImageUpload?: boolean
} = {}): SlashCommand[] {
  return includeImageUpload
    ? [...SLASH_COMMANDS, UPLOAD_IMAGE_SLASH_COMMAND]
    : SLASH_COMMANDS
}

type SlashCommandDefinition = SlashCommand & {
  execute: (editor: Editor) => boolean
}

const command = (
  id: string,
  label: string,
  keywords: string[],
  execute: SlashCommandDefinition["execute"]
): SlashCommandDefinition => ({ id, label, keywords, execute })

const DEFINITIONS: SlashCommandDefinition[] = [
  command(
    "heading-1",
    "\u4e00\u7ea7\u6807\u9898",
    ["heading-1", "heading", "\u6807\u9898", "h1", "\u4e00\u7ea7\u6807\u9898"],
    (editor) => editor.chain().focus().setNode("heading", { level: 1 }).run()
  ),
  command(
    "heading-2",
    "\u4e8c\u7ea7\u6807\u9898",
    ["heading-2", "heading", "\u6807\u9898", "h2", "\u4e8c\u7ea7\u6807\u9898"],
    (editor) => editor.chain().focus().setNode("heading", { level: 2 }).run()
  ),
  command(
    "heading-3",
    "\u4e09\u7ea7\u6807\u9898",
    ["heading-3", "heading", "\u6807\u9898", "h3", "\u4e09\u7ea7\u6807\u9898"],
    (editor) => editor.chain().focus().setNode("heading", { level: 3 }).run()
  ),
  command(
    "paragraph",
    "\u6bb5\u843d",
    ["paragraph", "\u6bb5\u843d", "text"],
    (editor) => editor.chain().focus().setParagraph().run()
  ),
  command(
    "bullet-list",
    "\u65e0\u5e8f\u5217\u8868",
    ["bullet", "bullet-list", "\u5217\u8868", "\u65e0\u5e8f"],
    (editor) => editor.chain().focus().toggleBulletList().run()
  ),
  command(
    "ordered-list",
    "\u6709\u5e8f\u5217\u8868",
    ["ordered", "ordered-list", "\u7f16\u53f7", "\u6709\u5e8f"],
    (editor) => editor.chain().focus().toggleOrderedList().run()
  ),
  command(
    "task-list",
    "\u4efb\u52a1\u5217\u8868",
    ["task", "task-list", "\u5f85\u529e", "\u4efb\u52a1"],
    (editor) => editor.chain().focus().toggleTaskList().run()
  ),
  command(
    "blockquote",
    "\u5f15\u7528",
    ["blockquote", "quote", "\u5f15\u7528"],
    (editor) => editor.chain().focus().toggleBlockquote().run()
  ),
  command(
    "code-block",
    "\u4ee3\u7801\u5757",
    ["code", "code-block", "\u4ee3\u7801", "\u4ee3\u7801\u5757"],
    (editor) => editor.chain().focus().toggleCodeBlock().run()
  ),
  command(
    "horizontal-rule",
    "\u5206\u9694\u7ebf",
    ["horizontal-rule", "divider", "\u5206\u9694\u7ebf"],
    (editor) => editor.chain().focus().setHorizontalRule().run()
  ),
  command(
    "table",
    "\u8868\u683c",
    ["table", "\u8868\u683c"],
    // 表格通过网格选择器插入；execute 仅作为兜底，默认插入 3×3。
    (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
  ),
  command(
    "canvas-block",
    "\u753b\u677f",
    ["canvas", "canvas-block", "\u753b\u677f", "\u767d\u677f", "tldraw"],
    (editor) => editor.chain().focus().insertCanvasBlock().run()
  ),
]

export const SLASH_COMMANDS: SlashCommand[] = DEFINITIONS.map(
  ({ id, label, keywords }) => ({
    id,
    label,
    keywords,
  })
)

export function filterSlashCommands(query: string): SlashCommand[] {
  return filterCommands(SLASH_COMMANDS, query)
}

export function filterCommands(
  commands: SlashCommand[],
  query: string
): SlashCommand[] {
  const normalizedQuery = query.trim().replace(/^\//, "").toLocaleLowerCase()

  if (!normalizedQuery) {
    return commands
  }

  return commands.filter((item) =>
    [item.id, item.label, ...item.keywords].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery)
    )
  )
}

const LEGACY_COMMAND_ALIASES: Record<string, string> = {
  heading: "heading-1",
}

export function executeSlashCommand(editor: Editor, id: string): boolean {
  const resolvedId = LEGACY_COMMAND_ALIASES[id] ?? id
  return (
    DEFINITIONS.find((item) => item.id === resolvedId)?.execute(editor) ?? false
  )
}

import type { Editor } from "@tiptap/core"

export type SlashCommand = {
  id: string
  label: string
  keywords: string[]
}

type SlashCommandDefinition = SlashCommand & {
  execute: (editor: Editor) => boolean
}

const command = (
  id: string,
  label: string,
  keywords: string[],
  execute: SlashCommandDefinition["execute"],
): SlashCommandDefinition => ({ id, label, keywords, execute })

const DEFINITIONS: SlashCommandDefinition[] = [
  command("heading", "标题", ["heading", "标题", "h1", "h2"], editor =>
    editor.chain().focus().setNode("heading", { level: 1 }).run(),
  ),
  command("paragraph", "段落", ["paragraph", "段落", "text"], editor =>
    editor.chain().focus().setParagraph().run(),
  ),
  command("bullet-list", "无序列表", ["bullet", "bullet-list", "列表", "无序"], editor =>
    editor.chain().focus().toggleBulletList().run(),
  ),
  command("ordered-list", "有序列表", ["ordered", "ordered-list", "编号", "有序"], editor =>
    editor.chain().focus().toggleOrderedList().run(),
  ),
  command("task-list", "任务列表", ["task", "task-list", "待办", "任务"], editor =>
    editor.chain().focus().toggleTaskList().run(),
  ),
  command("blockquote", "引用", ["blockquote", "quote", "引用"], editor =>
    editor.chain().focus().toggleBlockquote().run(),
  ),
  command("code-block", "代码块", ["code", "code-block", "代码", "代码块"], editor =>
    editor.chain().focus().toggleCodeBlock().run(),
  ),
  command("horizontal-rule", "分隔线", ["horizontal-rule", "divider", "分隔线"], editor =>
    editor.chain().focus().setHorizontalRule().run(),
  ),
]

export const SLASH_COMMANDS: SlashCommand[] = DEFINITIONS.map(({ id, label, keywords }) => ({
  id,
  label,
  keywords,
}))

export function filterSlashCommands(query: string): SlashCommand[] {
  const normalizedQuery = query.trim().replace(/^\//, "").toLocaleLowerCase()

  if (!normalizedQuery) {
    return SLASH_COMMANDS
  }

  return SLASH_COMMANDS.filter(item =>
    [item.id, item.label, ...item.keywords].some(value =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  )
}

export function executeSlashCommand(editor: Editor, id: string): boolean {
  return DEFINITIONS.find(item => item.id === id)?.execute(editor) ?? false
}


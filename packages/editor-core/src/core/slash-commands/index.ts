import { createCanvasBlockId } from "../canvas/canvas-snapshot"
import type { BlockEditor } from "../block-editor"
import { generateBlockId } from "../block-schema/ids"
import type {
  Block,
  BlockType,
  InlineContent,
  PartialBlock,
  TableContent,
} from "../block-schema/types"
import { createDefaultBlockSchemaRegistry } from "../schema/default-specs"
import type { BlockSchemaRegistry } from "../schema/registry"

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

/** 斜杠 AI 写作入口；由 UI 层接管，不走 executeSlashCommand */
export const AI_WRITE_SLASH_COMMAND: SlashCommand = {
  id: "ai-write",
  label: "AI 写作",
  keywords: ["ai", "写作", "续写"],
}

/** 内置斜杠项对应的 block type；heading-* 共用 heading */
const SLASH_COMMAND_BLOCK_TYPE: Record<string, string> = {
  "heading-1": "heading",
  "heading-2": "heading",
  "heading-3": "heading",
  paragraph: "paragraph",
  "bullet-list": "bulletListItem",
  "ordered-list": "numberedListItem",
  "task-list": "checkListItem",
  blockquote: "quote",
  "code-block": "codeBlock",
  "horizontal-rule": "divider",
  table: "table",
  "canvas-block": "canvas",
  "upload-image": "image",
}

function collectCustomSlashCommands(
  registry: BlockSchemaRegistry
): SlashCommand[] {
  const commands: SlashCommand[] = []
  for (const type of registry.getAllBlockTypes()) {
    const spec = registry.get(type)
    if (spec?.config.slashCommands?.length) {
      commands.push(...spec.config.slashCommands)
    }
  }
  return commands
}

/** 按 registry 过滤内置斜杠项，并追加 spec 上声明的自定义项 */
export function getSlashCommands({
  includeImageUpload = false,
  includeAiWrite = true,
  registry = createDefaultBlockSchemaRegistry(),
}: {
  includeImageUpload?: boolean
  /** 是否在斜杠菜单展示 AI 写作；默认开启，由宿主通过 context 决定是否可点 */
  includeAiWrite?: boolean
  registry?: BlockSchemaRegistry
} = {}): SlashCommand[] {
  const types = registry.getBlockContentTypes()
  const builtins = SLASH_DEFINITIONS.filter((command) => {
    const blockType = SLASH_COMMAND_BLOCK_TYPE[command.id]
    return !blockType || types.has(blockType)
  })
  const commands = [...builtins, ...collectCustomSlashCommands(registry)]
  const withImage =
    includeImageUpload && types.has("image")
      ? [...commands, UPLOAD_IMAGE_SLASH_COMMAND]
      : commands
  return includeAiWrite ? [AI_WRITE_SLASH_COMMAND, ...withImage] : withImage
}

/** 行内是否有实质内容（mention 算有内容，纯空白 text 不算） */
function inlineHasContent(content: InlineContent[]): boolean {
  for (const item of content) {
    if (item.type === "mention") {
      return true
    }
    if (item.type === "text" && item.text.length > 0) {
      return true
    }
    if (item.type === "link" && inlineHasContent(item.content)) {
      return true
    }
  }
  return false
}

/** 空块：content 无文字；mention 视为有内容 */
function isBlockEmpty(block: Block): boolean {
  if (!block.content) {
    return true
  }
  if (Array.isArray(block.content)) {
    return !inlineHasContent(block.content)
  }
  const table = block.content as TableContent
  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (inlineHasContent(cell.content)) {
        return false
      }
    }
  }
  return true
}

/** 默认 3×3 表格（首行为表头），与 insertTable(3,3) 行为一致 */
function createDefaultTableContent(): TableContent {
  const cell = (): { content: InlineContent[] } => ({ content: [] })
  const row = () => ({ cells: [cell(), cell(), cell()] })
  return {
    headerRows: 1,
    rows: [row(), row(), row()],
  }
}

/** 从当前选区向上找到 blockContainer 的 id */
function getTargetBlockId(editor: BlockEditor): string | null {
  const { from } = editor.tiptap.state.selection
  const doc = editor.tiptap.state.doc
  const $pos = doc.resolve(from)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (node.type.name === "blockContainer") {
      return node.attrs.id as string
    }
  }

  return editor.document[0]?.id ?? null
}

function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block
    }
    const nested = findBlockById(block.children, id)
    if (nested) {
      return nested
    }
  }
  return null
}

export type BlockCommandMode = "slash" | "convert"

type SlashHandler = (
  editor: BlockEditor,
  refId: string,
  empty: boolean,
  inPlace: boolean
) => void

/** 转换完成后把光标恢复到 blockContainer 的内容区 */
function focusBlockContent(editor: BlockEditor, blockId: string) {
  const { doc } = editor.tiptap.state
  let cursorPos: number | null = null

  doc.descendants((node, pos) => {
    if (cursorPos !== null) {
      return false
    }

    if (node.type.name === "blockContainer" && node.attrs.id === blockId) {
      const content = node.firstChild

      if (content?.isTextblock) {
        cursorPos = pos + 1 + content.nodeSize - 1
      }

      return false
    }

    return undefined
  })

  if (cursorPos !== null) {
    editor.tiptap.chain().focus().setTextSelection(Math.max(1, cursorPos)).run()
  }
}

/** 斜杠把空块就地改成非文本块后，末尾需补一段落以便继续输入 */
const TRAILING_PARAGRAPH_AFTER_TYPES = new Set<BlockType>([
  "divider",
  "image",
  "canvas",
  "table",
  "codeBlock",
])

function ensureTrailingParagraphAfter(editor: BlockEditor, refId: string) {
  const topLevel = editor.document
  if (topLevel[topLevel.length - 1]?.id !== refId) {
    return
  }

  editor.insertBlocks(
    [{ id: generateBlockId(), type: "paragraph", content: [] }],
    refId,
    "after"
  )
}

function applyTypeChange(
  editor: BlockEditor,
  refId: string,
  empty: boolean,
  inPlace: boolean,
  type: BlockType,
  options: {
    props?: Record<string, unknown>
    content?: PartialBlock["content"]
  } = {}
): void {
  const partial: PartialBlock = {
    type,
    props: options.props,
    content: options.content,
  }

  // 斜杠菜单：空块就地改类型；有内容则在后面插入新块。工具栏：始终就地转换并保留文字。
  if (empty || inPlace) {
    editor.updateBlock(refId, {
      type,
      props: options.props,
      ...(empty ? { content: options.content } : {}),
    })

    if (empty && TRAILING_PARAGRAPH_AFTER_TYPES.has(type)) {
      ensureTrailingParagraphAfter(editor, refId)
    }

    if (inPlace) {
      focusBlockContent(editor, refId)
    }
  } else {
    editor.insertBlocks([partial], refId, "after")
  }
}

const SLASH_HANDLERS: Record<string, SlashHandler> = {
  "heading-1": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "heading", {
      props: { level: 1 },
      content: [],
    }),
  "heading-2": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "heading", {
      props: { level: 2 },
      content: [],
    }),
  "heading-3": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "heading", {
      props: { level: 3 },
      content: [],
    }),
  paragraph: (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "paragraph", {
      content: [],
    }),
  "bullet-list": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "bulletListItem", {
      content: [],
    }),
  "ordered-list": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "numberedListItem", {
      content: [],
    }),
  "task-list": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "checkListItem", {
      props: { checked: false },
      content: [],
    }),
  blockquote: (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "quote", { content: [] }),
  "code-block": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "codeBlock", {
      props: { language: null },
      content: [],
    }),
  "horizontal-rule": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "divider"),
  table: (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "table", {
      content: createDefaultTableContent(),
    }),
  "canvas-block": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "canvas", {
      props: { canvasId: createCanvasBlockId(), snapshot: "" },
    }),
  "upload-image": (editor, refId, empty, inPlace) =>
    applyTypeChange(editor, refId, empty, inPlace, "image", {
      props: { src: null, uploadStatus: "idle" },
    }),
}

const SLASH_DEFINITIONS: SlashCommand[] = [
  {
    id: "heading-1",
    label: "\u4e00\u7ea7\u6807\u9898",
    keywords: [
      "heading-1",
      "heading",
      "\u6807\u9898",
      "h1",
      "\u4e00\u7ea7\u6807\u9898",
    ],
  },
  {
    id: "heading-2",
    label: "\u4e8c\u7ea7\u6807\u9898",
    keywords: [
      "heading-2",
      "heading",
      "\u6807\u9898",
      "h2",
      "\u4e8c\u7ea7\u6807\u9898",
    ],
  },
  {
    id: "heading-3",
    label: "\u4e09\u7ea7\u6807\u9898",
    keywords: [
      "heading-3",
      "heading",
      "\u6807\u9898",
      "h3",
      "\u4e09\u7ea7\u6807\u9898",
    ],
  },
  {
    id: "paragraph",
    label: "\u6bb5\u843d",
    keywords: ["paragraph", "\u6bb5\u843d", "text"],
  },
  {
    id: "bullet-list",
    label: "\u65e0\u5e8f\u5217\u8868",
    keywords: ["bullet", "bullet-list", "\u5217\u8868", "\u65e0\u5e8f"],
  },
  {
    id: "ordered-list",
    label: "\u6709\u5e8f\u5217\u8868",
    keywords: ["ordered", "ordered-list", "\u7f16\u53f7", "\u6709\u5e8f"],
  },
  {
    id: "task-list",
    label: "\u4efb\u52a1\u5217\u8868",
    keywords: ["task", "task-list", "\u5f85\u529e", "\u4efb\u52a1"],
  },
  {
    id: "blockquote",
    label: "\u5f15\u7528",
    keywords: ["blockquote", "quote", "\u5f15\u7528"],
  },
  {
    id: "code-block",
    label: "\u4ee3\u7801\u5757",
    keywords: ["code", "code-block", "\u4ee3\u7801", "\u4ee3\u7801\u5757"],
  },
  {
    id: "horizontal-rule",
    label: "\u5206\u9694\u7ebf",
    keywords: ["horizontal-rule", "divider", "\u5206\u9694\u7ebf"],
  },
  {
    id: "table",
    label: "\u8868\u683c",
    keywords: ["table", "\u8868\u683c"],
  },
  {
    id: "canvas-block",
    label: "\u753b\u677f",
    keywords: [
      "canvas",
      "canvas-block",
      "\u753b\u677f",
      "\u767d\u677f",
      "excalidraw",
    ],
  },
]

export const SLASH_COMMANDS: SlashCommand[] = getSlashCommands()

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

export function executeSlashCommand(
  editor: BlockEditor,
  id: string,
  options: { mode?: BlockCommandMode } = {}
): boolean {
  const resolvedId = LEGACY_COMMAND_ALIASES[id] ?? id
  const handler = SLASH_HANDLERS[resolvedId]
  if (!handler) {
    return false
  }

  const refId = getTargetBlockId(editor)
  if (!refId) {
    return false
  }

  const target = findBlockById(editor.document, refId)
  if (!target) {
    return false
  }

  const inPlace = options.mode === "convert"
  handler(editor, refId, isBlockEmpty(target), inPlace)
  return true
}

/** 工具栏块类型切换：就地转换当前块并保留已有文字 */
export function convertBlockCommand(editor: BlockEditor, id: string): boolean {
  return executeSlashCommand(editor, id, { mode: "convert" })
}

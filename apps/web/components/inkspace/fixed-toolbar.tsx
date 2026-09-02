"use client"

import { use, type MouseEvent, type ReactElement } from "react"
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  PilcrowIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  SmileIcon,
  TableIcon,
  UnderlineIcon,
  UndoIcon,
} from "@workspace/icons"
import type { Block, BlockEditor, TableContent } from "@xtai-notion/editor-core"
import {
  convertBlockCommand,
  getActiveBlockToolbarCommand,
  toggleInlineMark,
  type BlockToolbarCommand,
  type InlineMark,
} from "@xtai-notion/editor-core"
import {
  EditorContext,
  useBlockEditor,
  useEditorState,
} from "@xtai-notion/editor-react"
import {
  TableGridPicker,
  TextColorControl,
  useImageUpload,
} from "@xtai-notion/editor-shadcn"
import { MarkdownExportButton } from "./markdown-export-button"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Toggle } from "@workspace/ui/components/toggle"
import { cn } from "@workspace/ui/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { useEffect, useRef, useState } from "react"

// Base UI Toggle 用 aria-pressed 表示选中态，不用 Radix 的 data-state=on
const TOGGLE_ACTIVE_CLASS =
  "hover:!bg-[#F3F2EF] hover:!text-[#242321] aria-pressed:!bg-[#E6F3EC] aria-pressed:!text-[#24866B]"

const marks: Array<{
  label: string
  icon: typeof BoldIcon
  mark: InlineMark
}> = [
  { label: "粗体", icon: BoldIcon, mark: "bold" },
  { label: "斜体", icon: ItalicIcon, mark: "italic" },
  { label: "下划线", icon: UnderlineIcon, mark: "underline" },
  { label: "删除线", icon: StrikethroughIcon, mark: "strike" },
  { label: "行内代码", icon: CodeIcon, mark: "code" },
]

const blockTypeButtons = [
  { id: "paragraph", label: "正文", icon: PilcrowIcon, ariaLabel: "Paragraph" },
  {
    id: "heading-1",
    label: "一级标题",
    icon: Heading1Icon,
    ariaLabel: "Heading 1",
  },
  {
    id: "heading-2",
    label: "二级标题",
    icon: Heading2Icon,
    ariaLabel: "Heading 2",
  },
  {
    id: "bullet-list",
    label: "项目符号列表",
    icon: ListIcon,
    ariaLabel: "Bullet list",
  },
  {
    id: "ordered-list",
    label: "编号列表",
    icon: ListOrderedIcon,
    ariaLabel: "Numbered list",
  },
  {
    id: "task-list",
    label: "待办列表",
    icon: ListTodoIcon,
    ariaLabel: "Task list",
  },
  {
    id: "blockquote",
    label: "引用",
    icon: QuoteIcon,
    ariaLabel: "Blockquote",
  },
  {
    id: "code-block",
    label: "代码块",
    icon: CodeIcon,
    ariaLabel: "Code block",
  },
] as const satisfies ReadonlyArray<{
  id: BlockToolbarCommand
  label: string
  icon: typeof PilcrowIcon
  ariaLabel: string
}>

export function insertEmoji(
  editor: BlockEditor["tiptap"],
  emoji: string
): boolean {
  return editor.chain().focus().insertContent(emoji).run()
}

function blockHasVisibleContent(block: Block | undefined): boolean {
  if (!block?.content) return false
  if (Array.isArray(block.content)) {
    return block.content.some((item) =>
      item.type === "text" ? item.text.length > 0 : true
    )
  }
  return true
}

/** 阻止工具栏点击抢走编辑器选区 */
function keepEditorSelection(event: MouseEvent) {
  event.preventDefault()
}

function ToolbarTooltip({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function EmojiPicker({
  editor,
  onSelect,
}: {
  editor: BlockEditor["tiptap"]
  onSelect: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let picker: HTMLElement | undefined

    void Promise.all([import("emoji-mart"), import("@emoji-mart/data")]).then(
      ([{ Picker }, { default: data }]) => {
        if (cancelled || !containerRef.current) return

        picker = new Picker({
          data,
          locale: "zh",
          previewPosition: "none",
          onEmojiSelect: (emoji: { native?: string }) => {
            if (!emoji.native) return
            insertEmoji(editor, emoji.native)
            onSelect()
          },
        }) as unknown as HTMLElement
        container.replaceChildren()
        containerRef.current.append(picker)
      }
    )

    return () => {
      cancelled = true
      picker?.remove()
    }
  }, [editor])

  return (
    <div
      ref={containerRef}
      className="flex min-h-96 min-w-80 items-center justify-center"
    >
      <span className="text-sm text-muted-foreground">
        Loading emoji picker…
      </span>
    </div>
  )
}

function FixedEditorToolbarReady() {
  const editorContext = use(EditorContext)
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap
  const { canUpload, openFilePicker } = useImageUpload()
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  // 查看者隐藏；AI 写作 fork 会临时只读，但仍保留工具栏占位
  const canEditDocument = editorContext?.canEditDocument ?? editor.isEditable
  const toolbarDisabled = !editor.isEditable

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) => ({
      activeMarks: {
        bold: activeEditor.isActive("bold"),
        italic: activeEditor.isActive("italic"),
        underline: activeEditor.isActive("underline"),
        strike: activeEditor.isActive("strike"),
        code: activeEditor.isActive("code"),
      },
      activeBlockCommand: getActiveBlockToolbarCommand(activeEditor.state),
      canUndo: activeEditor.can().undo(),
      canRedo: activeEditor.can().redo(),
    }),
  })

  function toggleBlockCommand(
    commandId: BlockToolbarCommand,
    pressed: boolean
  ) {
    convertBlockCommand(blockEditor, pressed ? commandId : "paragraph")
  }

  function insertTable(rows: number, cols: number) {
    const tableBlock: Block = {
      id: crypto.randomUUID(),
      type: "table",
      props: {},
      content: {
        headerRows: 1,
        rows: Array.from({ length: rows }, () => ({
          cells: Array.from({ length: cols }, () => ({ content: [] })),
        })),
      } satisfies TableContent,
      children: [],
    }
    const selected = blockEditor.getSelectedBlocks()[0]
    if (selected && !blockHasVisibleContent(selected)) {
      blockEditor.updateBlock(selected.id, tableBlock)
    } else {
      blockEditor.insertBlocks(
        [tableBlock],
        selected?.id ?? blockEditor.document[0]!.id,
        "after"
      )
    }
  }

  if (!canEditDocument) return null

  return (
    <div
      className={cn(
        "z-20 flex min-h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[#E8E6E1] bg-[#FCFCFA] px-4 py-1.5",
        toolbarDisabled && "pointer-events-none opacity-60"
      )}
      role="toolbar"
      aria-label="Editor toolbar"
      aria-disabled={toolbarDisabled}
    >
      {marks.map(({ label, icon: Icon, mark }) => (
        <ToolbarTooltip key={mark} label={label}>
          <Toggle
            size="sm"
            className={TOGGLE_ACTIVE_CLASS}
            pressed={toolbarState.activeMarks[mark]}
            aria-label={label}
            onMouseDown={keepEditorSelection}
            onPressedChange={() => toggleInlineMark(editor, mark)}
          >
            <Icon />
          </Toggle>
        </ToolbarTooltip>
      ))}
      <ToolbarTooltip label="文字颜色">
        <TextColorControl editor={editor} onMouseDown={keepEditorSelection} />
      </ToolbarTooltip>
      <Separator orientation="vertical" className="mx-1 h-6" />
      {canUpload ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="上传图片"
                onMouseDown={keepEditorSelection}
                onClick={openFilePicker}
              >
                <ImageIcon />
              </Button>
            }
          />
          <TooltipContent>上传图片</TooltipContent>
        </Tooltip>
      ) : null}
      {blockTypeButtons.map(({ id, label, icon: Icon, ariaLabel }) => (
        <ToolbarTooltip key={id} label={label}>
          <Toggle
            size="sm"
            className={TOGGLE_ACTIVE_CLASS}
            aria-label={ariaLabel}
            pressed={toolbarState.activeBlockCommand === id}
            onMouseDown={keepEditorSelection}
            onPressedChange={(pressed) => toggleBlockCommand(id, pressed)}
          >
            <Icon />
          </Toggle>
        </ToolbarTooltip>
      ))}
      <Popover open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="插入表格"
                    onMouseDown={keepEditorSelection}
                  >
                    <TableIcon />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>插入表格</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-auto p-0">
          <TableGridPicker
            onSelect={(rows, cols) => {
              insertTable(rows, cols)
              setTablePickerOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Insert emoji"
                    onMouseDown={keepEditorSelection}
                  >
                    <SmileIcon />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>插入表情</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-auto p-0">
          {emojiPickerOpen && (
            <EmojiPicker
              editor={editor}
              onSelect={() => setEmojiPickerOpen(false)}
            />
          )}
        </PopoverContent>
      </Popover>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <MarkdownExportButton />
      <ToolbarTooltip label="撤销">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={!toolbarState.canUndo}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <UndoIcon />
        </Button>
      </ToolbarTooltip>
      <ToolbarTooltip label="重做">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          disabled={!toolbarState.canRedo}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <RedoIcon />
        </Button>
      </ToolbarTooltip>
    </div>
  )
}

export function FixedEditorToolbar() {
  const context = use(EditorContext)
  if (!context?.blockEditor) {
    return null
  }
  return <FixedEditorToolbarReady />
}

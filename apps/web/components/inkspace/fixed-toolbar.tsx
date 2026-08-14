"use client"

import { use, useEffect, useRef, useState, type ReactElement } from "react"
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
import { EditorContext, type Editor } from "@workspace/editor/react"
import { TableGridPicker, useImageUpload } from "@workspace/editor/components"
import { insertTable } from "@workspace/editor/core"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Toggle } from "@workspace/ui/components/toggle"
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

const marks = [
  ["粗体", BoldIcon, "bold"],
  ["斜体", ItalicIcon, "italic"],
  ["下划线", UnderlineIcon, "underline"],
  ["删除线", StrikethroughIcon, "strike"],
  ["行内代码", CodeIcon, "code"],
] as const

export function insertEmoji(editor: Editor, emoji: string): boolean {
  return editor.chain().focus().insertContent(emoji).run()
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
  editor: Editor
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

export function FixedEditorToolbar() {
  const context = use(EditorContext)
  const { canUpload, openFilePicker } = useImageUpload()
  const editor = context?.editor
  const readState = () => ({
    active: editor ? marks.map(([, , mark]) => editor.isActive(mark)) : [],
    canUndo: editor?.can().undo() ?? false,
    canRedo: editor?.can().redo() ?? false,
  })
  const [state, setState] = useState(readState)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)

  useEffect(() => {
    if (!editor) return
    const update = () => setState(readState())
    editor.on("transaction", update)
    editor.on("selectionUpdate", update)
    return () => {
      editor.off("transaction", update)
      editor.off("selectionUpdate", update)
    }
  }, [editor])

  if (!editor?.isEditable) return null

  return (
    <div
      className="sticky top-0 z-20 flex min-h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[#E8E6E1] bg-[#FCFCFA]/95 px-4 py-1.5 backdrop-blur"
      role="toolbar"
      aria-label="Editor toolbar"
    >
      {marks.map(([label, Icon, mark], index) => (
        <ToolbarTooltip key={mark} label={label}>
          <Toggle
            size="sm"
            pressed={state.active[index] ?? false}
            aria-label={label}
            onPressedChange={() =>
              editor.chain().focus().toggleMark(mark).run()
            }
          >
            <Icon />
          </Toggle>
        </ToolbarTooltip>
      ))}
      <Separator orientation="vertical" className="mx-1 h-6" />
      {canUpload ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="上传图片"
                onClick={openFilePicker}
              >
                <ImageIcon />
              </Button>
            }
          />
          <TooltipContent>上传图片</TooltipContent>
        </Tooltip>
      ) : null}
      <ToolbarTooltip label="正文">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="正文"
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <PilcrowIcon />
        </Button>
      </ToolbarTooltip>
      <ToolbarTooltip label="一级标题">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="一级标题"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1Icon />
        </Button>
      </ToolbarTooltip>
      <ToolbarTooltip label="二级标题">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="二级标题"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2Icon />
        </Button>
      </ToolbarTooltip>
      <ToolbarTooltip label="项目符号列表">
        <Toggle
          size="sm"
          aria-label="Bullet list"
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
        >
          <ListIcon />
        </Toggle>
      </ToolbarTooltip>
      <ToolbarTooltip label="编号列表">
        <Toggle
          size="sm"
          aria-label="Numbered list"
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
        >
          <ListOrderedIcon />
        </Toggle>
      </ToolbarTooltip>
      <ToolbarTooltip label="待办列表">
        <Toggle
          size="sm"
          aria-label="Task list"
          onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListTodoIcon />
        </Toggle>
      </ToolbarTooltip>
      <ToolbarTooltip label="引用">
        <Toggle
          size="sm"
          aria-label="Blockquote"
          onPressedChange={() =>
            editor.chain().focus().toggleBlockquote().run()
          }
        >
          <QuoteIcon />
        </Toggle>
      </ToolbarTooltip>
      <ToolbarTooltip label="代码块">
        <Toggle
          size="sm"
          aria-label="Code block"
          onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeIcon />
        </Toggle>
      </ToolbarTooltip>
      <Popover open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="插入表格">
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
              insertTable(editor, rows, cols)
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
                  <Button variant="ghost" size="icon-sm" aria-label="插入表情">
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
      <ToolbarTooltip label="撤销">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="撤销"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <UndoIcon />
        </Button>
      </ToolbarTooltip>
      <ToolbarTooltip label="重做">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="重做"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <RedoIcon />
        </Button>
      </ToolbarTooltip>
    </div>
  )
}

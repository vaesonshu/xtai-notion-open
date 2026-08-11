"use client"

import { use, useEffect, useRef, useState } from "react"
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  PilcrowIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  SmileIcon,
  UnderlineIcon,
  UndoIcon,
} from "@workspace/icons"
import { EditorContext, type Editor } from "@workspace/editor/react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Toggle } from "@workspace/ui/components/toggle"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

const marks = [
  ["Bold", BoldIcon, "bold"],
  ["Italic", ItalicIcon, "italic"],
  ["Underline", UnderlineIcon, "underline"],
  ["Strike", StrikethroughIcon, "strike"],
  ["Inline code", CodeIcon, "code"],
] as const

export function insertEmoji(editor: Editor, emoji: string): boolean {
  return editor.chain().focus().insertContent(emoji).run()
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
  const editor = context?.editor
  const readState = () => ({
    active: editor ? marks.map(([, , mark]) => editor.isActive(mark)) : [],
    canUndo: editor?.can().undo() ?? false,
    canRedo: editor?.can().redo() ?? false,
  })
  const [state, setState] = useState(readState)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

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
        <Toggle
          key={mark}
          size="sm"
          pressed={state.active[index] ?? false}
          aria-label={label}
          onPressedChange={() => editor.chain().focus().toggleMark(mark).run()}
        >
          <Icon />
        </Toggle>
      ))}
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <PilcrowIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1Icon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2Icon />
      </Button>
      <Toggle
        size="sm"
        aria-label="Bullet list"
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Numbered list"
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrderedIcon />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Task list"
        onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodoIcon />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Blockquote"
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Code block"
        onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeIcon />
      </Toggle>
      <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Insert emoji">
              <SmileIcon />
            </Button>
          }
        />
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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <UndoIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <RedoIcon />
      </Button>
    </div>
  )
}

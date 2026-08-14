"use client"

import { useState } from "react"
import type { Editor } from "@tiptap/core"
import { isTextSelection } from "@tiptap/core"
import type { EditorState } from "@tiptap/pm/state"
import { useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UnlinkIcon,
} from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Toggle } from "@workspace/ui/components/toggle"
import {
  setEditorLink,
  toggleInlineMark,
  type InlineMark,
} from "../../core/commands"
import { useEditorInstance } from "../../react/hooks/use-editor-instance"

export type ShouldShowBubbleToolbarProps = {
  editor: Editor
  state: EditorState
  from: number
  to: number
}

export function shouldShowBubbleToolbar({
  editor,
  state,
  from,
  to,
}: ShouldShowBubbleToolbarProps): boolean {
  if (!editor.isEditable) {
    return false
  }

  const { selection, doc } = state
  if (selection.empty || !isTextSelection(selection)) {
    return false
  }

  if (!doc.textBetween(from, to).length) {
    return false
  }

  return !editor.isActive("codeBlock")
}

const MARK_ACTIONS: Array<{
  mark: InlineMark
  label: string
  Icon: typeof BoldIcon
}> = [
  { mark: "bold", label: "粗体", Icon: BoldIcon },
  { mark: "italic", label: "斜体", Icon: ItalicIcon },
  { mark: "underline", label: "下划线", Icon: UnderlineIcon },
  { mark: "strike", label: "删除线", Icon: StrikethroughIcon },
  { mark: "code", label: "行内代码", Icon: CodeIcon },
]

function LinkControl({ editor }: { editor: Editor }) {
  const href = useEditorState({
    editor,
    selector: ({ editor: active }) =>
      (active.getAttributes("link").href as string | undefined) ?? "",
  })
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(href)

  return (
    <Popover
      open={open}
      onOpenChange={nextOpen => {
        setOpen(nextOpen)
        if (nextOpen) {
          setValue(href)
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="链接"
            aria-pressed={Boolean(href)}
          />
        }
      >
        <LinkIcon />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 gap-2 bg-white p-2 text-[#242321]"
      >
        <Input
          aria-label="链接地址"
          placeholder="https://"
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault()
              setEditorLink(editor, value)
              setOpen(false)
            }
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            aria-label="应用链接"
            onClick={() => {
              setEditorLink(editor, value)
              setOpen(false)
            }}
          >
            应用
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="移除链接"
            onClick={() => {
              setEditorLink(editor, "")
              setValue("")
              setOpen(false)
            }}
          >
            <UnlinkIcon />
            移除
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function BubbleToolbarControls({ editor }: { editor: Editor }) {
  const activeMarks = useEditorState({
    editor,
    selector: ({ editor: active }) => ({
      bold: active.isActive("bold"),
      italic: active.isActive("italic"),
      underline: active.isActive("underline"),
      strike: active.isActive("strike"),
      code: active.isActive("code"),
    }),
  })

  return (
    <div
      data-testid="bubble-toolbar"
      className="flex items-center gap-0.5 rounded-lg border border-[#E7E4DC] bg-white p-1 text-[#242321] shadow-md"
    >
      {MARK_ACTIONS.map(({ mark, label, Icon }) => (
        <Toggle
          key={mark}
          size="sm"
          className={`hover:!bg-[#F3F2EF] hover:!text-[#242321] ${activeMarks[mark] ? "!bg-[#E6F3EC] !text-[#24866B]" : ""}`}
          pressed={activeMarks[mark]}
          aria-label={label}
          onPressedChange={() => {
            toggleInlineMark(editor, mark)
          }}
        >
          <Icon />
        </Toggle>
      ))}
      <LinkControl editor={editor} />
    </div>
  )
}

export function BubbleToolbar() {
  const editor = useEditorInstance()

  if (!editor.isEditable) {
    return null
  }

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={0}
      shouldShow={({ editor: activeEditor, state, from, to }) =>
        shouldShowBubbleToolbar({
          editor: activeEditor,
          state,
          from,
          to,
        })
      }
    >
      <BubbleToolbarControls editor={editor} />
    </BubbleMenu>
  )
}

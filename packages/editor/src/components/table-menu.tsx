"use client"

import type { Editor } from "@tiptap/core"
import { BubbleMenu } from "@tiptap/react/menus"
import { useEditorState } from "@tiptap/react"
import {
  Columns2Icon,
  Rows2Icon,
  TableIcon,
  XIcon,
} from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { useEditorInstance } from "../react/use-editor-instance"

type TableAction = {
  label: string
  run: (editor: Editor) => void
}

// 行/列增删操作，直接映射到官方 table 命令。
const TABLE_ACTIONS: TableAction[] = [
  {
    label: "在上方插入行",
    run: (editor) => editor.chain().focus().addRowBefore().run(),
  },
  {
    label: "在下方插入行",
    run: (editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    label: "在左侧插入列",
    run: (editor) => editor.chain().focus().addColumnBefore().run(),
  },
  {
    label: "在右侧插入列",
    run: (editor) => editor.chain().focus().addColumnAfter().run(),
  },
  { label: "删除行", run: (editor) => editor.chain().focus().deleteRow().run() },
  {
    label: "删除列",
    run: (editor) => editor.chain().focus().deleteColumn().run(),
  },
]

function ActionIcon({ label }: { label: string }) {
  if (label.includes("列")) return <Columns2Icon />
  return <Rows2Icon />
}

/** 表格选中时的浮动工具栏，提供行/列增删与删除表格操作。 */
export function TableMenu() {
  const editor = useEditorInstance()

  const isInTable = useEditorState({
    editor,
    selector: ({ editor: active }) => active.isActive("table"),
  })

  if (!editor.isEditable || !isInTable) {
    return null
  }

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={0}
      shouldShow={({ editor: active }) => active.isActive("table")}
    >
      <div
        data-testid="table-menu"
        className="flex items-center gap-0.5 rounded-lg border border-[#E7E4DC] bg-white p-1 text-[#242321] shadow-md"
      >
        <span className="flex items-center px-1.5 text-[#9A9488]">
          <TableIcon size={14} />
        </span>
        {TABLE_ACTIONS.map(({ label, run }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => run(editor)}
          >
            <ActionIcon label={label} />
          </Button>
        ))}
        <span className="mx-1 h-4 w-px bg-[#E7E4DC]" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="删除表格"
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          <XIcon />
        </Button>
      </div>
    </BubbleMenu>
  )
}

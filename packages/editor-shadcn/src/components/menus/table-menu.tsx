"use client"

import type { Editor } from "@tiptap/core"
import { BubbleMenu } from "@tiptap/react/menus"
import { useEditorState } from "@tiptap/react"
import {
  Columns2Icon,
  Rows2Icon,
  TableIcon,
  XIcon,
} from "../../icons"
import { Button } from "../../ui/button"
import { useEditorInstance } from "@xtai-notion/editor-react"

type TableAction = {
  label: string
  run: (editor: Editor) => void
}

/** Table 扩展命令由 core 注册；默认 ChainedCommands 类型未合并这些 API。 */
type TableChain = ReturnType<Editor["chain"]> & {
  addRowBefore: () => ReturnType<Editor["chain"]>
  addRowAfter: () => ReturnType<Editor["chain"]>
  addColumnBefore: () => ReturnType<Editor["chain"]>
  addColumnAfter: () => ReturnType<Editor["chain"]>
  deleteRow: () => ReturnType<Editor["chain"]>
  deleteColumn: () => ReturnType<Editor["chain"]>
  deleteTable: () => ReturnType<Editor["chain"]>
}

function tableChain(editor: Editor): TableChain {
  return editor.chain().focus() as TableChain
}

// 行/列增删操作，直接映射到官方 table 命令。
const TABLE_ACTIONS: TableAction[] = [
  {
    label: "在上方插入行",
    run: (editor) => {
      tableChain(editor).addRowBefore().run()
    },
  },
  {
    label: "在下方插入行",
    run: (editor) => {
      tableChain(editor).addRowAfter().run()
    },
  },
  {
    label: "在左侧插入列",
    run: (editor) => {
      tableChain(editor).addColumnBefore().run()
    },
  },
  {
    label: "在右侧插入列",
    run: (editor) => {
      tableChain(editor).addColumnAfter().run()
    },
  },
  {
    label: "删除行",
    run: (editor) => {
      tableChain(editor).deleteRow().run()
    },
  },
  {
    label: "删除列",
    run: (editor) => {
      tableChain(editor).deleteColumn().run()
    },
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
          onClick={() => tableChain(editor).deleteTable().run()}
        >
          <XIcon />
        </Button>
      </div>
    </BubbleMenu>
  )
}

"use client"

import DragHandle from "@tiptap/extension-drag-handle-react"
import { GripVerticalIcon } from "../../icons"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"

/** 启用嵌套块拖拽，与块树模型一致。 */
export const BLOCK_HANDLE_NESTED = true as const

export function BlockHandle() {
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap

  return (
    <DragHandle
      editor={editor}
      nested={BLOCK_HANDLE_NESTED}
      className="editor-block-handle"
    >
      <button
        type="button"
        data-testid="block-handle"
        aria-label="拖拽块"
        className="editor-block-handle__grip"
        tabIndex={-1}
      >
        <GripVerticalIcon aria-hidden className="size-4" />
      </button>
    </DragHandle>
  )
}

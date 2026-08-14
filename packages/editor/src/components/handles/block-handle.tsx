"use client"

import DragHandle from "@tiptap/extension-drag-handle-react"
import { GripVerticalIcon } from "@workspace/icons"
import { useEditorInstance } from "../../react/hooks/use-editor-instance"

/**
 * Disable nested targeting so drag only moves compatible top-level blocks
 * and does not break nested list structure (design.md).
 */
export const BLOCK_HANDLE_NESTED = false as const

export function BlockHandle() {
  const editor = useEditorInstance()

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

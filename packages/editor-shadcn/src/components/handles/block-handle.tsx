"use client"

import DragHandle from "@tiptap/extension-drag-handle-react"
import type { NestedOptions } from "@tiptap/extension-drag-handle"
import { GripVerticalIcon } from "../../icons"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"

/** 拖拽规则：优先选中 blockContainer，避免误拖 paragraph 等 blockContent。 */
export const BLOCK_DRAG_NESTED_OPTIONS: NestedOptions = {
  rules: [
    {
      id: "preferBlockContainer",
      evaluate: ({ node }) => {
        if (node.type.name === "blockContainer") {
          return 0
        }
        if (node.type.name === "blockGroup") {
          return 800
        }
        if (node.type.spec.group?.split(" ").includes("blockContent")) {
          return 900
        }
        return 0
      },
    },
  ],
}

export function BlockHandle() {
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap

  return (
    <DragHandle
      editor={editor}
      nested={BLOCK_DRAG_NESTED_OPTIONS}
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

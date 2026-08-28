"use client"

import type { NestedOptions } from "@tiptap/extension-drag-handle"
import { GripVerticalIcon } from "../../icons"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"
import { startBlockContainerDrag } from "./block-drag-start"
import { useBlockSideMenu } from "./use-block-side-menu"

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
  const { state, controllerRef, setFloating, floatingStyles } =
    useBlockSideMenu(editor)

  if (!state.show || !state.blockNode || state.blockPos < 0) {
    return null
  }

  return (
    <div
      ref={setFloating}
      className="editor-block-handle"
      style={floatingStyles}
    >
      <button
        type="button"
        data-testid="block-handle"
        aria-label="拖拽块"
        className="editor-block-handle__grip"
        tabIndex={-1}
        draggable
        onDragStart={(event) => {
          controllerRef.current?.freezeMenu()

          startBlockContainerDrag(
            event.nativeEvent,
            editor,
            state.blockPos,
            state.blockNode!
          )
        }}
        onDragEnd={() => {
          controllerRef.current?.unfreezeMenu()
        }}
      >
        <GripVerticalIcon aria-hidden className="size-[1.375rem]" />
      </button>
    </div>
  )
}

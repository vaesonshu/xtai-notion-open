"use client"

import { GripVerticalIcon, PlusIcon } from "../../icons"
import { startBlockContainerDrag } from "@xtai-notion/editor-core"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"
import { insertBlockAndOpenSlashMenu } from "./block-side-menu-actions"
import { useBlockSideMenu } from "./use-block-side-menu"

export function BlockHandle() {
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap
  const { state, setFloating, floatingStyles, freezeMenu, unfreezeMenu } =
    useBlockSideMenu(blockEditor)

  if (!state.show || !state.blockNode || state.blockPos < 0 || !state.blockId) {
    return null
  }

  const sideMenuAttributes: Record<string, string> = {}

  if (state.blockType) {
    sideMenuAttributes["data-block-type"] = state.blockType
  }

  if (state.blockType === "heading" && state.headingLevel !== null) {
    sideMenuAttributes["data-level"] = String(state.headingLevel)
  }

  if (state.hasFileUrl !== null) {
    sideMenuAttributes["data-url"] = state.hasFileUrl ? "true" : "false"
  }

  return (
    <div
      ref={setFloating}
      className="editor-block-side-menu"
      style={floatingStyles}
      {...sideMenuAttributes}
    >
      <button
        type="button"
        data-testid="block-add"
        aria-label="添加块"
        className="editor-block-side-menu__add"
        tabIndex={-1}
        onClick={() => {
          insertBlockAndOpenSlashMenu(blockEditor, state.blockId!)
        }}
      >
        <PlusIcon aria-hidden className="size-[1.375rem]" />
      </button>
      <button
        type="button"
        data-testid="block-handle"
        aria-label="拖拽块"
        className="editor-block-side-menu__grip"
        tabIndex={-1}
        draggable
        onDragStart={(event) => {
          freezeMenu()

          startBlockContainerDrag(
            event.nativeEvent,
            editor,
            state.blockPos,
            state.blockNode!
          )
        }}
        onDragEnd={() => {
          unfreezeMenu()
        }}
      >
        <GripVerticalIcon aria-hidden className="size-[1.375rem]" />
      </button>
    </div>
  )
}

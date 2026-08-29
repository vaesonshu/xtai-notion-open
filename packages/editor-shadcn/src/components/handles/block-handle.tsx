"use client"

import { useState } from "react"
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "../../icons"
import { startBlockContainerDrag } from "@xtai-notion/editor-core"
import { useBlockEditor } from "@xtai-notion/editor-react/hooks/use-block-editor"
import {
  deleteSelectedBlock,
  insertParagraphBelowBlock,
  selectBlockContainer,
} from "./block-side-menu-actions"
import { useBlockSideMenu } from "./use-block-side-menu"
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover"

export function BlockHandle() {
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap
  const { state, setFloating, floatingStyles, freezeMenu, unfreezeMenu } =
    useBlockSideMenu(blockEditor)
  const [menuOpen, setMenuOpen] = useState(false)

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
          setMenuOpen(false)
          unfreezeMenu()
          insertParagraphBelowBlock(blockEditor, state.blockId!)
        }}
      >
        <PlusIcon aria-hidden className="size-[1.375rem]" />
      </button>
      <Popover
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open)
          if (open) {
            freezeMenu()
            selectBlockContainer(blockEditor, state.blockPos)
            return
          }
          unfreezeMenu()
        }}
      >
        <PopoverTrigger
          data-testid="block-handle"
          aria-label="拖拽或打开块菜单"
          className="editor-block-side-menu__grip"
          tabIndex={-1}
          draggable
          onPointerDown={() => {
            selectBlockContainer(blockEditor, state.blockPos)
          }}
          onClick={() => {
            selectBlockContainer(blockEditor, state.blockPos)
          }}
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
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="editor-block-menu-popup w-40 gap-0.5 border border-[#E7E4DC] bg-white p-1 text-[#242321] shadow-md"
          onMouseEnter={() => freezeMenu()}
          onPointerEnter={() => freezeMenu()}
        >
          <button
            type="button"
            data-testid="block-delete"
            className="editor-block-menu-item"
            onClick={() => {
              // 执行动作后立刻收起菜单，避免 freeze 把空弹层留在页面上
              setMenuOpen(false)
              unfreezeMenu()
              deleteSelectedBlock(blockEditor, state.blockId!)
            }}
          >
            <Trash2Icon aria-hidden className="size-4" />
            删除
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

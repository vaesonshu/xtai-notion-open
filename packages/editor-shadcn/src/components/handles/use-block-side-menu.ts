"use client"

import { offset, useFloating } from "@floating-ui/react"
import type { BlockEditor } from "@xtai-notion/editor-core"
import type { BlockSideMenuState } from "@xtai-notion/editor-core"
import { useEffect, useMemo, useState, type CSSProperties } from "react"

const INITIAL_STATE: BlockSideMenuState = {
  show: false,
  referencePos: null,
  blockId: null,
  blockPos: -1,
  blockNode: null,
  blockType: null,
  headingLevel: null,
  hasFileUrl: null,
}

/** 拖拽把手与正文左缘的间距（px） */
const SIDE_MENU_TEXT_GAP = 8

/** 侧栏 hook 对外暴露的稳定类型，避免 dts 构建引用 csstype 包路径 */
export interface BlockSideMenuHookResult {
  state: BlockSideMenuState
  setFloating: (node: HTMLElement | null) => void
  floatingStyles: CSSProperties
  freezeMenu: () => void
  unfreezeMenu: () => void
}

/** 订阅 BlockEditor 侧栏状态，并用 Floating UI 定位侧栏控件 */
export function useBlockSideMenu(
  blockEditor: BlockEditor
): BlockSideMenuHookResult {
  const [state, setState] = useState<BlockSideMenuState>(INITIAL_STATE)

  useEffect(() => {
    return blockEditor.sideMenu.subscribe(setState)
  }, [blockEditor])

  const { refs, update, floatingStyles } = useFloating({
    open: state.show,
    placement: "left-start",
    middleware: [offset(SIDE_MENU_TEXT_GAP)],
  })

  useEffect(() => {
    update()
  }, [state.referencePos, update])

  useEffect(() => {
    if (!state.referencePos) {
      return
    }

    refs.setReference({
      getBoundingClientRect: () => state.referencePos as DOMRect,
    })
  }, [refs, state.referencePos])

  const sideMenuStyles = useMemo((): CSSProperties => {
    const contentHeight = state.referencePos?.height

    return {
      // Floating UI 的 style 类型来自 csstype，显式收窄为 React.CSSProperties
      ...(floatingStyles as CSSProperties),
      // 侧栏高度跟随块内容，left-start 顶对齐 + flex 居中 → 全类型文本垂直居中
      ...(contentHeight
        ? { height: `${Math.max(contentHeight, 22)}px` }
        : null),
    }
  }, [floatingStyles, state.referencePos?.height])

  return useMemo(
    () => ({
      state,
      setFloating: refs.setFloating,
      floatingStyles: sideMenuStyles,
      freezeMenu: () => blockEditor.sideMenu.freezeMenu(),
      unfreezeMenu: () => blockEditor.sideMenu.unfreezeMenu(),
    }),
    [blockEditor, refs.setFloating, sideMenuStyles, state]
  )
}

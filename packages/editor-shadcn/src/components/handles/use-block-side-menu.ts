"use client"

import { useFloating } from "@floating-ui/react"
import type { BlockEditor } from "@xtai-notion/editor-core"
import type { BlockSideMenuState } from "@xtai-notion/editor-core"
import { useEffect, useMemo, useState } from "react"

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

/** 订阅 BlockEditor 侧栏状态，并用 Floating UI 定位侧栏控件 */
export function useBlockSideMenu(blockEditor: BlockEditor) {
  const [state, setState] = useState<BlockSideMenuState>(INITIAL_STATE)

  useEffect(() => {
    return blockEditor.sideMenu.subscribe(setState)
  }, [blockEditor])

  const { refs, update, floatingStyles } = useFloating({
    open: state.show,
    placement: "left-start",
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

  return useMemo(
    () => ({
      state,
      setFloating: refs.setFloating,
      floatingStyles,
      freezeMenu: () => blockEditor.sideMenu.freezeMenu(),
      unfreezeMenu: () => blockEditor.sideMenu.unfreezeMenu(),
    }),
    [blockEditor, floatingStyles, refs.setFloating, state]
  )
}

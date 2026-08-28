"use client"

import { useFloating } from "@floating-ui/react"
import type { Editor } from "@tiptap/core"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  BLOCK_SIDE_MENU_PLUGIN_KEY,
  type BlockSideMenuState,
  createBlockSideMenuController,
} from "./block-side-menu-plugin"

const INITIAL_STATE: BlockSideMenuState = {
  show: false,
  referencePos: null,
  blockId: null,
  blockPos: -1,
  blockNode: null,
}

/** 订阅侧栏插件状态，并用 Floating UI 定位拖拽把手 */
export function useBlockSideMenu(editor: Editor) {
  const controllerRef = useRef(
    null as ReturnType<typeof createBlockSideMenuController> | null
  )
  const [state, setState] = useState<BlockSideMenuState>(INITIAL_STATE)

  useEffect(() => {
    if (editor.isDestroyed) {
      return
    }

    const controller = createBlockSideMenuController(editor)
    controllerRef.current = controller
    editor.registerPlugin(controller.plugin)

    const unsubscribe = controller.subscribe(setState)

    return () => {
      unsubscribe()

      if (!editor.isDestroyed) {
        editor.unregisterPlugin(BLOCK_SIDE_MENU_PLUGIN_KEY)
      }

      controllerRef.current = null
    }
  }, [editor])

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
      controllerRef,
      setFloating: refs.setFloating,
      floatingStyles,
    }),
    [floatingStyles, refs.setFloating, state]
  )
}

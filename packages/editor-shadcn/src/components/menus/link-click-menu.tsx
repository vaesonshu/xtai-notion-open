"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@tiptap/core"
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type VirtualElement,
} from "@floating-ui/react"
import { LinkIcon, PencilIcon } from "../../icons"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import {
  applyLinkAtRange,
  type LinkMarkRange,
} from "../editor/capture-link-range"
import { dismissSlashMenu } from "./dismiss-slash-menu"
import { openEditorHref } from "../editor/open-editor-href"

export type LinkClickMenuState = {
  href: string
  anchorRect: DOMRect
  linkRange: LinkMarkRange
}

type LinkClickMenuProps = {
  editor: Editor
  state: LinkClickMenuState
  navigate?: (href: string) => void
  onClose: () => void
}

/** 编辑态点击行内链接时的操作菜单：可修改地址或跳转目标页 */
export function LinkClickMenu({
  editor,
  state,
  navigate,
  onClose,
}: LinkClickMenuProps) {
  const [mode, setMode] = useState<"actions" | "edit">("actions")
  const [value, setValue] = useState(state.href)
  // 打开弹层时冻结 range，避免后续 render 丢失选区信息
  const linkRangeRef = useRef(state.linkRange)

  useEffect(() => {
    if (state.linkRange) {
      linkRangeRef.current = state.linkRange
    }
  }, [state.linkRange])

  const virtualElement: VirtualElement = useMemo(
    () => ({
      getBoundingClientRect: () => state.anchorRect,
    }),
    [state.anchorRect]
  )

  const { refs, floatingStyles } = useFloating<VirtualElement>({
    open: true,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["top-start", "bottom-end", "top-end"] }),
      shift({ padding: 8 }),
    ],
  })

  useEffect(() => {
    refs.setReference(virtualElement)
  }, [refs, virtualElement])

  useEffect(() => {
    dismissSlashMenu(editor)
  }, [editor])

  useEffect(() => {
    setMode("actions")
    setValue(state.href)
  }, [state.href])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      const floating = refs.floating.current
      if (floating?.contains(target)) {
        return
      }

      onClose()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, refs.floating])

  function handleEdit() {
    // 在弹层 Input 中改 URL，勿 focus 回编辑器，否则链接文本里的 `/` 会触发 slash
    dismissSlashMenu(editor)
    setMode("edit")
  }

  function handleApplyEdit() {
    applyLinkAtRange(editor, linkRangeRef.current, value)
    dismissSlashMenu(editor)
    onClose()
  }

  function handleOpen() {
    openEditorHref(state.href, navigate)
    onClose()
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      handleApplyEdit()
    }
  }

  if (typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      data-testid="link-click-menu"
      className="z-50 w-72 rounded-lg border border-[#E7E4DC] bg-white p-2 text-[#242321] shadow-md"
      role="dialog"
      aria-label="链接操作"
    >
      {mode === "actions" ? (
        <div className="flex flex-col gap-2">
          <p
            className="truncate px-1 text-xs text-[#78746C]"
            title={state.href}
          >
            {state.href}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5"
              aria-label="编辑链接"
              onClick={handleEdit}
            >
              <PencilIcon size={14} />
              编辑
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 gap-1.5"
              aria-label="打开链接"
              onClick={handleOpen}
            >
              <LinkIcon size={14} />
              打开
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            aria-label="链接地址"
            placeholder="https://"
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              aria-label="返回"
              onClick={() => setMode("actions")}
            >
              返回
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              aria-label="应用链接"
              onClick={handleApplyEdit}
            >
              应用
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

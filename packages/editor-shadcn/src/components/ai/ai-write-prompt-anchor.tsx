"use client"

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

/** 提示条贴在块底边下方，避免盖住草稿块 */
const GAP_BELOW_BLOCK_PX = 8
/** jsdom 无布局或找不到块时，回退到视口底部，避免整页不可见 */
const FALLBACK_BOTTOM_PX = 32

type OverlayBox = {
  top: number
  left: number
  width: number
}

export type AiWritePromptAnchorProps = {
  anchorBlockId: string
  children: ReactNode
}

function measureAnchor(anchorBlockId: string): OverlayBox | null {
  const el = document.querySelector(
    `[data-node-type="blockContainer"][data-id="${anchorBlockId}"]`
  )
  if (!el) {
    return null
  }
  const rect = el.getBoundingClientRect()
  return {
    top: rect.bottom + GAP_BELOW_BLOCK_PX,
    left: rect.left,
    width: rect.width,
  }
}

/**
 * 把提示条 portal 到 body，按块容器 getBoundingClientRect 贴在块下方。
 * 全屏定位（fixed / 坐标）放在本层，不放在 AiWritePromptBar 卡片上。
 */
export function AiWritePromptAnchor({
  anchorBlockId,
  children,
}: AiWritePromptAnchorProps) {
  const [box, setBox] = useState<OverlayBox | null>(null)

  const measure = useCallback(() => {
    setBox(measureAnchor(anchorBlockId))
  }, [anchorBlockId])

  useEffect(() => {
    measure()
    const listenerOptions = { passive: true } as const
    window.addEventListener("scroll", measure, listenerOptions)
    window.addEventListener("resize", measure, listenerOptions)
    return () => {
      window.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
    }
  }, [measure])

  if (typeof document === "undefined") {
    return null
  }

  const style: CSSProperties = box
    ? {
        position: "fixed",
        top: `${box.top}px`,
        left: `${box.left}px`,
        width: `${box.width}px`,
      }
    : {
        position: "fixed",
        left: "50%",
        bottom: `${FALLBACK_BOTTOM_PX}px`,
        transform: "translateX(-50%)",
      }

  return createPortal(
    <div
      data-testid="ai-writing-overlay"
      className="pointer-events-auto z-50"
      style={style}
    >
      {children}
    </div>,
    document.body
  )
}

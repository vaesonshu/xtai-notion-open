"use client"

import { useRef, useState, type MouseEvent } from "react"
import type { Editor } from "@tiptap/core"
import { useEditorState } from "@tiptap/react"
import {
  normalizeTextColorInput,
  setTextColor,
  unsetTextColor,
} from "@xtai-notion/editor-core/commands"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover"
import {
  colorsMatch,
  hexToHsl,
  hslToHex,
  type HslColor,
} from "./text-color-utils"

/** 兼容旧导出：主题默认文字色 */
export const TEXT_COLOR_PRESETS = [
  { label: "默认", value: null, swatch: "#242321" },
] as const

export type TextColorControlProps = {
  editor: Editor
  /** 固定工具栏需要阻止 mousedown 抢焦点 */
  onMouseDown?: (event: MouseEvent) => void
  triggerClassName?: string
}

function resolvePickerValue(color: string | null | undefined): string {
  return normalizeTextColorInput(color ?? "") ?? "#242321"
}

function ColorField({
  hue,
  saturation,
  lightness,
  onPreview,
  onCommit,
}: {
  hue: number
  saturation: number
  lightness: number
  onPreview: (next: HslColor) => void
  onCommit: (next: HslColor) => void
}) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const lastPickRef = useRef<HslColor>({ h: hue, s: saturation, l: lightness })

  function pickColor(clientX: number, clientY: number) {
    const rect = fieldRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height)
    const next = {
      h: hue,
      s: (x / rect.width) * 100,
      l: 100 - (y / rect.height) * 100,
    }
    lastPickRef.current = next
    onPreview(next)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // 仅阻止默认行为以保留编辑器选区，不调用 editor.focus()
    event.preventDefault()
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    pickColor(event.clientX, event.clientY)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) {
      return
    }

    event.preventDefault()
    pickColor(event.clientX, event.clientY)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) {
      return
    }

    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    onCommit(lastPickRef.current)
  }

  return (
    <div
      ref={fieldRef}
      role="application"
      aria-label="饱和度与明度"
      className="relative h-32 w-full cursor-crosshair overflow-hidden rounded-lg border border-[#E7E4DC]"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/10"
        style={{
          left: `${saturation}%`,
          top: `${100 - lightness}%`,
          backgroundColor: hslToHex(hue, saturation, lightness),
        }}
      />
    </div>
  )
}

export function TextColorControl({
  editor,
  onMouseDown,
  triggerClassName,
}: TextColorControlProps) {
  const activeColor = useEditorState({
    editor,
    selector: ({ editor: active }) => {
      const color = active.getAttributes("textStyle").color
      return typeof color === "string" && color.length > 0 ? color : null
    },
  })
  const [open, setOpen] = useState(false)
  const [customValue, setCustomValue] = useState(activeColor ?? "")
  const [hsl, setHsl] = useState<HslColor>(() =>
    hexToHsl(activeColor ?? "#24866B")
  )

  const previewColor = hslToHex(hsl.h, hsl.s, hsl.l)

  function syncFromColor(color: string | null | undefined) {
    if (!color) {
      return
    }

    const normalized = resolvePickerValue(color)
    setHsl(hexToHsl(normalized))
    setCustomValue(normalized)
  }

  function previewHsl(next: HslColor) {
    setHsl(next)
    setCustomValue(hslToHex(next.h, next.s, next.l))
  }

  function commitHex(color: string, options?: { close?: boolean }) {
    const normalized = normalizeTextColorInput(color)
    if (!normalized) {
      return false
    }

    // 提交颜色时不抢焦点，避免 Popover 被关闭、输入框无法使用
    setTextColor(editor, normalized, { focus: false })
    setCustomValue(normalized)
    setHsl(hexToHsl(normalized))

    if (options?.close) {
      setOpen(false)
    }

    return true
  }

  function applyColor(color: string | null, options?: { close?: boolean }) {
    if (color) {
      commitHex(color, options)
      return
    }

    unsetTextColor(editor, { focus: false })
    if (options?.close) {
      setOpen(false)
    }
  }

  function applyCustomColor() {
    if (!commitHex(customValue, { close: true })) {
      return
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          syncFromColor(activeColor ?? customValue)
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="文字颜色"
            aria-pressed={Boolean(activeColor)}
            className={triggerClassName}
            onMouseDown={onMouseDown}
          />
        }
      >
        <span className="relative inline-flex">
          <span className="text-sm leading-none font-semibold">A</span>
          <span
            aria-hidden
            className="absolute right-0 -bottom-1 left-0 h-0.5 rounded-full"
            style={{ backgroundColor: activeColor ?? "#242321" }}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 gap-3 bg-white p-3 text-[#242321]"
        data-testid="text-color-popover"
      >
        <ColorField
          hue={hsl.h}
          saturation={hsl.s}
          lightness={hsl.l}
          onPreview={previewHsl}
          onCommit={(next) =>
            commitHex(hslToHex(next.h, next.s, next.l))
          }
        />

        <div className="space-y-2">
          <label className="text-xs text-[#9A9488]">色相</label>
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hsl.h)}
            aria-label="色相"
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background:
                "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
            }}
            onPointerDown={(event) => event.preventDefault()}
            onChange={(event) => {
              const next = {
                ...hsl,
                h: Number(event.target.value),
              }
              previewHsl(next)
              commitHex(hslToHex(next.h, next.s, next.l))
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-8 w-8 shrink-0 rounded-md border border-[#E7E4DC]"
            style={{ backgroundColor: previewColor }}
          />
          <input
            type="color"
            aria-label="选择颜色"
            value={resolvePickerValue(customValue || previewColor)}
            className="h-8 w-10 cursor-pointer rounded-md border border-[#E7E4DC] bg-white p-0.5"
            onPointerDown={(event) => event.preventDefault()}
            onChange={(event) => {
              const nextColor = event.target.value.toUpperCase()
              previewHsl(hexToHsl(nextColor))
              commitHex(nextColor)
            }}
          />
          <Input
            aria-label="颜色值"
            placeholder="#24866B"
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                applyCustomColor()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            aria-label="应用颜色"
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyCustomColor}
          >
            应用
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            aria-label="恢复默认颜色"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              applyColor(null, { close: true })
              setCustomValue("")
              setHsl({ h: 0, s: 0, l: 14 })
            }}
          >
            默认颜色
          </Button>
          {activeColor ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              aria-label="清除颜色"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                applyColor(null, { close: true })
                setCustomValue("")
              }}
            >
              清除颜色
            </Button>
          ) : null}
        </div>

        {activeColor && colorsMatch(activeColor, previewColor) ? (
          <p className="text-center text-xs text-[#9A9488]">当前已应用此颜色</p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

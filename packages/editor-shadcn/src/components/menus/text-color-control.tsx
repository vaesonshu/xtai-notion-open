"use client"

import { useState, type MouseEvent } from "react"
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
import { cn } from "../../lib/utils"

/** 预设文字颜色，与 Inkspace 主题色板保持一致 */
export const TEXT_COLOR_PRESETS = [
  { label: "默认", value: null, swatch: "#242321" },
  { label: "灰色", value: "#9A9488", swatch: "#9A9488" },
  { label: "棕色", value: "#9F6B53", swatch: "#9F6B53" },
  { label: "橙色", value: "#D9730D", swatch: "#D9730D" },
  { label: "黄色", value: "#CB912F", swatch: "#CB912F" },
  { label: "绿色", value: "#24866B", swatch: "#24866B" },
  { label: "蓝色", value: "#0B6E99", swatch: "#0B6E99" },
  { label: "紫色", value: "#6940A5", swatch: "#6940A5" },
  { label: "粉色", value: "#AD1A72", swatch: "#AD1A72" },
  { label: "红色", value: "#E03E3E", swatch: "#E03E3E" },
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

  function applyColor(color: string | null) {
    if (color) {
      setTextColor(editor, color)
      return
    }

    unsetTextColor(editor)
  }

  function applyCustomColor() {
    const normalized = normalizeTextColorInput(customValue)
    if (!normalized) {
      return
    }

    setTextColor(editor, normalized)
    setCustomValue(normalized)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setCustomValue(activeColor ?? "")
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
        className="w-64 gap-3 bg-white p-3 text-[#242321]"
        data-testid="text-color-popover"
      >
        <div className="grid grid-cols-5 gap-2">
          {TEXT_COLOR_PRESETS.map(({ label, value, swatch }) => {
            const isActive =
              value === null ? activeColor === null : activeColor === value

            return (
              <button
                key={label}
                type="button"
                aria-label={label}
                title={label}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                  isActive
                    ? "border-[#24866B] ring-2 ring-[#E6F3EC]"
                    : "border-[#E7E4DC] hover:border-[#CFCAC0]"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  applyColor(value)
                  if (value) {
                    setCustomValue(value)
                  }
                }}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded-full border",
                    value === null && "border-[#E7E4DC] bg-white"
                  )}
                  style={value ? { backgroundColor: swatch } : undefined}
                />
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[#9A9488]">自定义颜色</p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="选择颜色"
              value={resolvePickerValue(customValue || activeColor)}
              className="h-8 w-10 cursor-pointer rounded-md border border-[#E7E4DC] bg-white p-0.5"
              onMouseDown={(event) => event.preventDefault()}
              onChange={(event) => {
                const nextColor = event.target.value
                setCustomValue(nextColor)
                setTextColor(editor, nextColor)
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
              onClick={applyCustomColor}
            >
              应用
            </Button>
          </div>
        </div>

        {activeColor ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            aria-label="清除颜色"
            onClick={() => {
              applyColor(null)
              setCustomValue("")
            }}
          >
            清除颜色
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

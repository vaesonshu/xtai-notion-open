"use client"

import { useState } from "react"
import { LoaderCircleIcon } from "../../icons"
import { Button } from "../../ui/button"

/** 与 web session 对齐的状态机；closed 时不渲染提示条 */
export type AiWritingStatus =
  | "user-input"
  | "thinking"
  | "ai-writing"
  | "user-reviewing"
  | "error"
  | "closed"

export type AiWritePreset = {
  id: string
  label: string
  prompt: string
}

export type AiWritePromptBarProps = {
  status: AiWritingStatus
  errorMessage?: string
  onSubmit: (prompt: string) => void
  onAccept: () => void
  onReject: () => void
  onStop: () => void
  presets: AiWritePreset[]
}

/** slash 模式默认快捷指令 */
export const SLASH_AI_WRITE_PRESETS: AiWritePreset[] = [
  { id: "continue", label: "续写", prompt: "请根据上文续写内容" },
  { id: "outline", label: "列大纲", prompt: "请为当前主题列出大纲" },
  { id: "casual", label: "改口语", prompt: "请把内容改得更口语化" },
]

/** selection 模式默认快捷指令 */
export const SELECTION_AI_WRITE_PRESETS: AiWritePreset[] = [
  { id: "polish", label: "润色", prompt: "请润色选中内容" },
  { id: "expand", label: "扩写", prompt: "请扩写选中内容" },
  { id: "concise", label: "更简洁", prompt: "请把选中内容写得更简洁" },
]

export function AiWritePromptBar({
  status,
  errorMessage,
  onSubmit,
  onAccept,
  onReject,
  onStop,
  presets,
}: AiWritePromptBarProps) {
  const [prompt, setPrompt] = useState("")

  if (status === "closed") {
    return null
  }

  const isBusy = status === "thinking" || status === "ai-writing"

  function handleSubmit() {
    const trimmed = prompt.trim()
    if (!trimmed || isBusy) {
      return
    }
    onSubmit(trimmed)
    setPrompt("")
  }

  return (
    <div
      data-testid="ai-write-prompt-bar"
      className="flex flex-col gap-2 rounded-lg border border-[#E8E4DC] bg-white p-3 text-sm text-[#242321] shadow-[0_8px_24px_rgba(36,35,33,0.12)]"
    >
      {status === "error" ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage ?? "生成失败，请重试"}
        </p>
      ) : null}

      {status === "user-input" ? (
        <>
          <textarea
            data-testid="ai-write-prompt-input"
            aria-label="AI 写作提示"
            className="min-h-16 w-full resize-none rounded-md border border-[#E8E4DC] bg-white px-3 py-2 text-sm outline-none focus-visible:border-[#24866B] focus-visible:ring-2 focus-visible:ring-[#24866B]/20"
            placeholder="描述你想让 AI 写什么…"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                handleSubmit()
              }
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onSubmit(preset.prompt)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              size="xs"
              className="ml-auto"
              disabled={!prompt.trim()}
              onClick={handleSubmit}
            >
              生成
            </Button>
          </div>
        </>
      ) : null}

      {isBusy ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[#5C574E]">
            <LoaderCircleIcon className="size-4 animate-spin" />
            {status === "thinking" ? "思考中…" : "AI 写作中…"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="ai-write-stop"
            onClick={onStop}
          >
            停止
          </Button>
        </div>
      ) : null}

      {status === "user-reviewing" ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="ai-write-reject"
            onClick={onReject}
          >
            拒绝
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid="ai-write-accept"
            onClick={onAccept}
          >
            接受
          </Button>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="ai-write-reject"
            onClick={onReject}
          >
            关闭
          </Button>
        </div>
      ) : null}
    </div>
  )
}

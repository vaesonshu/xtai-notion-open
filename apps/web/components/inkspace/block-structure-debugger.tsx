"use client"

import type { Block } from "@xtai-notion/editor-core"
import {
  EditorContext,
  useEditorBlocks,
  useEditorPmJson,
} from "@xtai-notion/editor-react"
import { use, useState } from "react"

type DebugView = "blocks" | "prosemirror"

function formatJson(value: Block[] | Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}

/** 开发态浮层：实时展示 Block[] 与 ProseMirror 文档树。 */
export function BlockStructureDebugger() {
  const context = use(EditorContext)
  // 协作模式下 blockEditor 异步就绪，需等待后再订阅
  if (!context?.blockEditor) {
    return null
  }

  return <BlockStructureDebuggerReady />
}

function BlockStructureDebuggerReady() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<DebugView>("blocks")
  const blocks = useEditorBlocks({
    onChange: (next) => {
      console.debug("[editor:blocks]", next)
    },
  })
  const pmJson = useEditorPmJson({
    onChange: (next) => {
      console.debug("[editor:pm]", next)
    },
  })

  if (!open) {
    return (
      <button
        type="button"
        aria-label="打开文档结构调试面板"
        className="fixed right-4 bottom-4 z-50 rounded-lg border border-[#D8D2C4] bg-white/95 px-3 py-1.5 text-xs font-medium text-[#5C574E] shadow-sm backdrop-blur hover:bg-[#FCFCFA]"
        onClick={() => setOpen(true)}
      >
        文档结构
      </button>
    )
  }

  const viewLabel =
    view === "blocks" ? "Block[] 业务结构" : "ProseMirror 编辑树"

  return (
    <aside
      aria-label="文档结构调试面板"
      className="fixed right-4 bottom-4 z-50 flex w-[min(32rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-[#D8D2C4] bg-white/95 shadow-lg backdrop-blur"
    >
      <header className="flex items-center justify-between gap-2 border-b border-[#E8E6E1] px-3 py-2">
        <div className="flex items-center gap-1">
          <ViewTab
            active={view === "blocks"}
            label="Block[]"
            onClick={() => setView("blocks")}
          />
          <ViewTab
            active={view === "prosemirror"}
            label="ProseMirror"
            onClick={() => setView("prosemirror")}
          />
        </div>
        <button
          type="button"
          aria-label="关闭文档结构面板"
          className="shrink-0 rounded px-2 py-0.5 text-xs text-[#8A857A] hover:bg-[#F3F1EC] hover:text-[#242321]"
          onClick={() => setOpen(false)}
        >
          关闭
        </button>
      </header>
      <p className="border-b border-[#E8E6E1] px-3 py-1.5 text-[10px] text-[#8A857A]">
        {viewLabel}
      </p>
      <pre className="max-h-96 overflow-auto p-3 text-[11px] leading-5 text-[#242321]">
        {view === "blocks" ? formatJson(blocks) : formatJson(pmJson)}
      </pre>
    </aside>
  )
}

function ViewTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={
        active
          ? "rounded bg-[#F3F1EC] px-2 py-0.5 text-xs font-medium text-[#242321]"
          : "rounded px-2 py-0.5 text-xs text-[#8A857A] hover:bg-[#F3F1EC] hover:text-[#242321]"
      }
      onClick={onClick}
    >
      {label}
    </button>
  )
}

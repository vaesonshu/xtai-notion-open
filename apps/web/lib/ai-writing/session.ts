import {
  applyAiWriteOp,
  canReplayAiWriteOps,
  extractDraftBlocks,
  isEmptyTextBlock,
  type AiWriteMode,
  type AiWriteOp,
  BlockEditor,
  type Block,
} from "@xtai-notion/editor-core"

export type AiWritingStatus =
  | "user-input"
  | "thinking"
  | "ai-writing"
  | "user-reviewing"
  | "error"
  | "closed"

export type AiWritingSession = {
  readonly mode: AiWriteMode
  readonly emptyCursorBlockToDelete: string | undefined
  status: AiWritingStatus
  errorMessage?: string
  ops: AiWriteOp[]
  shadow: BlockEditor
  applyRemoteOp(op: AiWriteOp): void
  draftBlocks(): Block[]
  accept(): { ok: true } | { ok: false; reason: "stale" | "empty" }
  reject(): void
  stop(): void
}

/** 在 live 文档树中按 id 查找块 */
function findBlockById(blocks: Block[], id: string): Block | undefined {
  for (const block of blocks) {
    if (block.id === id) {
      return block
    }
    const nested = findBlockById(block.children, id)
    if (nested) {
      return nested
    }
  }
  return undefined
}

export function createAiWritingSession(input: {
  live: BlockEditor
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
}): AiWritingSession {
  const { live, mode, cursorBlockId } = input
  const initialContent = structuredClone(live.document)

  // 影子编辑器：深拷贝 live 内容，只读预览 AI 改动
  const shadow = new BlockEditor({
    initialContent,
    editable: false,
  })

  const cursorBlock = findBlockById(live.document, cursorBlockId)
  const emptyCursorBlockToDelete =
    mode === "slash" && cursorBlock && isEmptyTextBlock(cursorBlock)
      ? cursorBlockId
      : undefined

  const session: AiWritingSession = {
    mode,
    emptyCursorBlockToDelete,
    status: "user-input",
    ops: [],
    shadow,
    applyRemoteOp(op) {
      const result = applyAiWriteOp(shadow, op)
      if (!result.ok) {
        return
      }
      session.ops.push(result.op)
      session.status = "ai-writing"
    },
    draftBlocks() {
      return extractDraftBlocks(shadow, session.ops)
    },
    accept() {
      if (session.ops.length === 0) {
        return { ok: false, reason: "empty" }
      }
      if (!canReplayAiWriteOps(live, session.ops)) {
        return { ok: false, reason: "stale" }
      }

      for (const op of session.ops) {
        const result = applyAiWriteOp(live, op)
        if (!result.ok) {
          return { ok: false, reason: "stale" }
        }
      }

      // slash 空段落：插入成功后再删占位块
      if (emptyCursorBlockToDelete) {
        const block = findBlockById(live.document, emptyCursorBlockToDelete)
        if (block && isEmptyTextBlock(block)) {
          live.removeBlocks([emptyCursorBlockToDelete])
        }
      }

      shadow.destroy()
      session.status = "closed"
      return { ok: true }
    },
    reject() {
      shadow.destroy()
      session.status = "closed"
    },
    stop() {
      // 中止流式生成后保留已预览的 ops，供用户审阅
      session.status = session.ops.length > 0 ? "user-reviewing" : "closed"
    },
  }

  return session
}

import type { Doc as YDoc } from "yjs"
import {
  applyAiWriteOp,
  collectAiWriteDraftIds,
  isEmptyTextBlock,
  mergeForkInto,
  setAiWriteDraftIds,
  type AiWriteMode,
  type AiWriteOp,
  type Block,
  type BlockEditor,
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
  sharedStale: boolean
  applyRemoteOp(op: AiWriteOp): void
  draftIds(): string[]
  lastTouchedBlockId(): string | undefined
  markSharedStale(): void
  accept(): { ok: true } | { ok: false; reason: "stale" | "empty" | "merge" }
  reject(): void
  stop(): void
}

/** 在 fork 文档树中按 id 查找块 */
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
  shared: YDoc
  fork: YDoc
  forkEditor: BlockEditor
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
}): AiWritingSession {
  const { shared, fork, forkEditor, mode, cursorBlockId } = input

  const cursorBlock = findBlockById(forkEditor.document, cursorBlockId)
  const emptyCursorBlockToDelete =
    mode === "slash" && cursorBlock && isEmptyTextBlock(cursorBlock)
      ? cursorBlockId
      : undefined

  const session: AiWritingSession = {
    mode,
    emptyCursorBlockToDelete,
    status: "user-input",
    ops: [],
    sharedStale: false,
    applyRemoteOp(op) {
      // 只写 fork，接受前不得污染 shared Y.Doc
      const result = applyAiWriteOp(forkEditor, op)
      if (!result.ok) {
        return
      }
      session.ops.push(result.op)
      session.status = "ai-writing"
      setAiWriteDraftIds(forkEditor, session.draftIds())
    },
    draftIds() {
      return collectAiWriteDraftIds(session.ops)
    },
    lastTouchedBlockId() {
      const ids = session.draftIds()
      return ids.length > 0 ? ids[ids.length - 1] : cursorBlockId
    },
    markSharedStale() {
      session.sharedStale = true
    },
    accept() {
      if (session.ops.length === 0) {
        return { ok: false, reason: "empty" }
      }
      if (session.sharedStale) {
        return { ok: false, reason: "stale" }
      }

      // slash 空段落：merge 前从 fork 删掉仍为空的占位块
      if (emptyCursorBlockToDelete) {
        const block = findBlockById(
          forkEditor.document,
          emptyCursorBlockToDelete
        )
        if (block && isEmptyTextBlock(block)) {
          forkEditor.removeBlocks([emptyCursorBlockToDelete])
        }
      }

      try {
        mergeForkInto(shared, fork)
      } catch {
        return { ok: false, reason: "merge" }
      }

      // 不销毁 fork Y.Doc：Host 改绑后再 destroy
      session.status = "closed"
      return { ok: true }
    },
    reject() {
      session.status = "closed"
    },
    stop() {
      // 中止流式生成后保留已写入 fork 的 ops，供用户审阅
      session.status = session.ops.length > 0 ? "user-reviewing" : "closed"
    },
  }

  return session
}

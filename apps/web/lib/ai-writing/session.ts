import type { Doc as YDoc } from "yjs"
import {
  collectAiWriteDraftIds,
  createAiWriteStreamApplier,
  isEmptyTextBlock,
  mergeForkInto,
  setAiWriteDraftIds,
  type AiWriteMode,
  type AiWriteOp,
  type AiWritePartialEvent,
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
  applyPartial(event: AiWritePartialEvent): void
  applyRemoteOp(op: AiWriteOp, toolIndex?: number): void
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

/** 合成/完整 op 是否含非空文本，供 accept 判断空草稿 */
function opsHaveNonEmptyText(ops: AiWriteOp[]): boolean {
  for (const op of ops) {
    if (op.type === "insert_blocks") {
      if (op.blocks.some((block) => block.text.length > 0)) {
        return true
      }
      continue
    }
    if (op.text.length > 0) {
      return true
    }
  }
  return false
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

  // 流式状态机只写 fork；同一 toolIndex 只 insert 一次
  const applier = createAiWriteStreamApplier({
    editor: forkEditor,
    mode,
    cursorBlockId,
    selectedIds: input.selectedIds,
  })
  // toolIndex → session.ops 下标，避免完整 tool_call 重复入列
  const committedToolIndexes = new Map<number, number>()

  const session: AiWritingSession = {
    mode,
    emptyCursorBlockToDelete,
    status: "user-input",
    ops: [],
    sharedStale: false,
    applyPartial(event) {
      const result = applier.applyPartial(event)
      if (!result.applied) {
        return
      }
      session.status = "ai-writing"
      setAiWriteDraftIds(forkEditor, session.draftIds())
    },
    applyRemoteOp(op, toolIndex) {
      // 缺 toolIndex 时按已提交 ops 序号退化；同一 index 不重复 push
      const index = toolIndex ?? session.ops.length
      const result = applier.applyComplete(index, op)
      if (!result.ok || !result.op) {
        return
      }
      const existing = committedToolIndexes.get(index)
      if (existing !== undefined) {
        session.ops[existing] = result.op
      } else {
        committedToolIndexes.set(index, session.ops.length)
        session.ops.push(result.op)
      }
      session.status = "ai-writing"
      setAiWriteDraftIds(forkEditor, session.draftIds())
    },
    draftIds() {
      return collectAiWriteDraftIds(
        session.ops.length > 0 ? session.ops : applier.synthesizeOps()
      )
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
        session.ops = applier.synthesizeOps()
      }
      // 无 op，或草稿与 op 文本都空，视为没有可接受内容
      if (
        session.ops.length === 0 ||
        (!applier.hasNonEmptyDraft() && !opsHaveNonEmptyText(session.ops))
      ) {
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
      if (applier.hasNonEmptyDraft() || session.ops.length > 0) {
        session.status = "user-reviewing"
        if (session.ops.length === 0) {
          session.ops = applier.synthesizeOps()
        }
        return
      }
      session.status = "closed"
    },
  }

  return session
}

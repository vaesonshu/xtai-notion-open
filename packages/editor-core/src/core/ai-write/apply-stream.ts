import type { BlockEditor } from "../block-editor"
import { generateBlockId } from "../block-schema/ids"
import type { Block, InlineContent } from "../block-schema/types"
import { applyAiWriteOp, textToInlineContent } from "./apply"
import { sanitizePartialToolArgs } from "./parse-partial"
import type {
  AiInsertBlockInput,
  AiWritableBlockType,
  AiWriteMode,
  AiWriteOp,
} from "./types"
import { isAiWritableBlockType } from "./types"

export type AiWritePartialEvent = {
  type: "tool_partial"
  toolIndex: number
  name: "insert_blocks" | "update_block"
  args: Record<string, unknown>
}

export type AiWriteStreamApplier = {
  applyPartial(event: AiWritePartialEvent): {
    applied: boolean
    touchedId?: string
  }
  applyComplete(
    toolIndex: number,
    op: AiWriteOp
  ): {
    ok: boolean
    op?: AiWriteOp
  }
  synthesizeOps(): AiWriteOp[]
  hasNonEmptyDraft(): boolean
}

/** 流式 insert 的本地块映射：同一 toolIndex 只插一次，后续靠 id 拉长文本 */
type InsertState = {
  name: "insert_blocks"
  refId: string
  placement: "before" | "after"
  blocks: { id: string; type: string; lastText: string }[]
  completed: boolean
}

type UpdateState = {
  name: "update_block"
  id: string
  started: boolean
  completed: boolean
}

type StreamState = InsertState | UpdateState

/** 递归查找块，供流式更新与草稿合成读取当前纯文本 */
function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block
    const nested = findBlockById(block.children, id)
    if (nested) return nested
  }
  return null
}

function inlineToPlainText(content: InlineContent[]): string {
  let text = ""
  for (const item of content) {
    if (item.type === "text") text += item.text
    else if (item.type === "mention") text += item.label
    else if (item.type === "link") text += inlineToPlainText(item.content)
  }
  return text
}

function blockPlainText(block: Block | null): string {
  if (!block || !Array.isArray(block.content)) return ""
  return inlineToPlainText(block.content)
}

function propsEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})
}

function asPlacement(value: unknown): "before" | "after" | null {
  return value === "before" || value === "after" ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function insertOne(
  editor: BlockEditor,
  input: {
    type: AiWritableBlockType
    text: string
    props?: Record<string, unknown>
  },
  refId: string,
  placement: "before" | "after"
): string {
  const id = generateBlockId()
  editor.insertBlocks(
    [
      {
        id,
        type: input.type,
        props: input.props ?? {},
        content: textToInlineContent(input.text),
        children: [],
      },
    ],
    refId,
    placement
  )
  return id
}

function updateLocalBlock(
  editor: BlockEditor,
  id: string,
  input: {
    type?: string
    text?: string
    props?: Record<string, unknown>
  }
): void {
  const update: {
    type?: Block["type"]
    props?: Record<string, unknown>
    content?: Block["content"]
  } = {}
  if (input.type !== undefined && isAiWritableBlockType(input.type)) {
    update.type = input.type
  }
  if (input.props !== undefined) update.props = input.props
  if (input.text !== undefined) {
    update.content = textToInlineContent(input.text)
  }
  editor.updateBlock(id, update)
}

function isUpdateAllowed(
  mode: AiWriteMode,
  id: string,
  cursorBlockId: string,
  selectedIds: string[]
): boolean {
  if (mode === "slash") return id === cursorBlockId
  return selectedIds.includes(id)
}

/**
 * 在 fork 编辑器上把流式 tool_partial 收敛成「插一次、再 update」的状态机，
 * 避免每个 token 都 insert 出重复块。
 */
export function createAiWriteStreamApplier(input: {
  editor: BlockEditor
  mode: AiWriteMode
  cursorBlockId: string
  selectedIds: string[]
}): AiWriteStreamApplier {
  const { editor, mode, cursorBlockId, selectedIds } = input
  const states = new Map<number, StreamState>()
  const committed = new Map<number, AiWriteOp>()

  function applyInsertPartial(
    toolIndex: number,
    args: Record<string, unknown>
  ): { applied: boolean; touchedId?: string } {
    const refId = typeof args.refId === "string" ? args.refId : null
    const placement = asPlacement(args.placement)
    if (!refId || !placement || !findBlockById(editor.document, refId)) {
      return { applied: false }
    }

    let state = states.get(toolIndex)
    if (state && state.name !== "insert_blocks") {
      return { applied: false }
    }
    if (state?.completed) return { applied: false }

    // 延迟创建 insert 状态：空尾块 skip 时不登记，避免 synthesize 吐出空 op
    const ensureInsertState = (): InsertState => {
      if (state?.name === "insert_blocks") return state
      const next: InsertState = {
        name: "insert_blocks",
        refId,
        placement,
        blocks: [],
        completed: false,
      }
      state = next
      states.set(toolIndex, next)
      return next
    }

    const rawBlocks = Array.isArray(args.blocks) ? args.blocks : []
    let applied = false
    let touchedId: string | undefined
    let localIndex = 0

    for (let i = 0; i < rawBlocks.length; i++) {
      const raw = asRecord(rawBlocks[i])
      if (!raw) continue
      const type = raw.type
      if (typeof type !== "string" || !isAiWritableBlockType(type)) {
        continue
      }

      const text = typeof raw.text === "string" ? raw.text : null
      const props = asRecord(raw.props) ?? undefined
      const isLast = i === rawBlocks.length - 1
      const pendingInsert =
        state?.name === "insert_blocks" ? state : states.get(toolIndex)
      const existing =
        pendingInsert?.name === "insert_blocks"
          ? pendingInsert.blocks[localIndex]
          : undefined

      if (!existing) {
        // 最后一个空块多半还在流式截断，等有正文再 insert
        if (text === null || text.length === 0) {
          if (isLast) continue
        }
        const insertState = ensureInsertState()
        const prev = insertState.blocks[localIndex - 1]
        const id = insertOne(
          editor,
          { type, text: text ?? "", props },
          prev ? prev.id : insertState.refId,
          prev ? "after" : insertState.placement
        )
        insertState.blocks.push({ id, type, lastText: text ?? "" })
        applied = true
        touchedId = id
        localIndex += 1
        continue
      }

      const insertState = ensureInsertState()
      const docBlock = findBlockById(editor.document, existing.id)
      const nextText = text ?? existing.lastText
      const typeChanged = existing.type !== type
      const textChanged = existing.lastText !== nextText
      const propsChanged =
        props !== undefined && !propsEqual(props, docBlock?.props)
      if (typeChanged || textChanged || propsChanged) {
        updateLocalBlock(editor, existing.id, {
          type,
          text: nextText,
          props,
        })
        existing.type = type
        existing.lastText = nextText
        applied = true
        touchedId = existing.id
      }
      localIndex += 1
    }

    return applied ? { applied: true, touchedId } : { applied: false }
  }

  function applyUpdatePartial(
    toolIndex: number,
    args: Record<string, unknown>
  ): { applied: boolean; touchedId?: string } {
    const id = typeof args.id === "string" ? args.id : null
    if (!id || !findBlockById(editor.document, id)) {
      return { applied: false }
    }
    if (!isUpdateAllowed(mode, id, cursorBlockId, selectedIds)) {
      return { applied: false }
    }

    let state = states.get(toolIndex)
    if (state && state.name !== "update_block") {
      return { applied: false }
    }
    if (!state) {
      state = {
        name: "update_block",
        id,
        started: false,
        completed: false,
      }
      states.set(toolIndex, state)
    }
    if (state.completed || state.id !== id) return { applied: false }

    const blockType =
      typeof args.blockType === "string" ? args.blockType : undefined
    const props = asRecord(args.props) ?? undefined
    const hasText = typeof args.text === "string"
    // 仅首次缺 text 时用空串覆盖旧文；后续 partial 无 text 则保留已打出内容
    const text =
      hasText ? args.text : state.started ? undefined : ""
    updateLocalBlock(editor, id, { type: blockType, text, props })
    state.started = true
    return { applied: true, touchedId: id }
  }

  function applyPartial(event: AiWritePartialEvent): {
    applied: boolean
    touchedId?: string
  } {
    const sanitized = sanitizePartialToolArgs(event.name, event.args)
    if (!sanitized) return { applied: false }
    if (sanitized.name === "insert_blocks") {
      return applyInsertPartial(event.toolIndex, sanitized.args)
    }
    return applyUpdatePartial(event.toolIndex, sanitized.args)
  }

  function completeInsert(
    state: InsertState,
    op: Extract<AiWriteOp, { type: "insert_blocks" }>
  ): { ok: true; op: AiWriteOp } | { ok: false } {
    const blocksWithIds: AiInsertBlockInput[] = []
    for (let i = 0; i < op.blocks.length; i++) {
      const input = op.blocks[i]!
      let local = state.blocks[i]
      if (!local) {
        const prev = state.blocks[i - 1]
        const id = insertOne(
          editor,
          input,
          prev ? prev.id : state.refId,
          prev ? "after" : state.placement
        )
        local = { id, type: input.type, lastText: input.text }
        state.blocks.push(local)
      } else {
        updateLocalBlock(editor, local.id, {
          type: input.type,
          text: input.text,
          props: input.props,
        })
        local.type = input.type
        local.lastText = input.text
      }
      blocksWithIds.push({ ...input, id: local.id })
    }
    state.completed = true
    const finalOp: AiWriteOp = {
      type: "insert_blocks",
      refId: op.refId,
      placement: op.placement,
      blocks: blocksWithIds,
    }
    return { ok: true, op: finalOp }
  }

  function completeUpdate(
    state: UpdateState,
    op: Extract<AiWriteOp, { type: "update_block" }>
  ): { ok: true; op: AiWriteOp } {
    updateLocalBlock(editor, state.id, {
      type: op.blockType,
      text: op.text,
      props: op.props,
    })
    state.completed = true
    state.started = true
    return { ok: true, op }
  }

  function applyComplete(
    toolIndex: number,
    op: AiWriteOp
  ): { ok: boolean; op?: AiWriteOp } {
    const state = states.get(toolIndex)
    if (!state) {
      const result = applyAiWriteOp(editor, op)
      if (!result.ok) return { ok: false }
      if (result.op.type === "insert_blocks") {
        states.set(toolIndex, {
          name: "insert_blocks",
          refId: result.op.refId,
          placement: result.op.placement,
          blocks: result.op.blocks.flatMap((block) =>
            block.id
              ? [{ id: block.id, type: block.type, lastText: block.text }]
              : []
          ),
          completed: true,
        })
      } else {
        states.set(toolIndex, {
          name: "update_block",
          id: result.op.id,
          started: true,
          completed: true,
        })
      }
      committed.set(toolIndex, result.op)
      return { ok: true, op: result.op }
    }

    if (state.completed) return { ok: false }

    if (state.name === "insert_blocks") {
      if (op.type !== "insert_blocks") return { ok: false }
      const result = completeInsert(state, op)
      if (!result.ok) return { ok: false }
      committed.set(toolIndex, result.op)
      return result
    }

    if (op.type !== "update_block") return { ok: false }
    const result = completeUpdate(state, op)
    committed.set(toolIndex, result.op)
    return result
  }

  function synthesizeOps(): AiWriteOp[] {
    const ops: AiWriteOp[] = []
    const indexes = [...states.keys()].toSorted((a, b) => a - b)
    for (const toolIndex of indexes) {
      const state = states.get(toolIndex)!
      if (state.completed) {
        const op = committed.get(toolIndex)
        if (op) ops.push(op)
        continue
      }
      if (state.name === "insert_blocks") {
        ops.push({
          type: "insert_blocks",
          refId: state.refId,
          placement: state.placement,
          blocks: state.blocks.flatMap((local) => {
            const block = findBlockById(editor.document, local.id)
            if (!block || !isAiWritableBlockType(block.type)) return []
            return [
              {
                id: local.id,
                type: block.type,
                text: blockPlainText(block),
                props: block.props,
              },
            ]
          }),
        })
        continue
      }
      const block = findBlockById(editor.document, state.id)
      ops.push({
        type: "update_block",
        id: state.id,
        blockType:
          block && isAiWritableBlockType(block.type) ? block.type : undefined,
        text: blockPlainText(block),
        props: block?.props,
      })
    }
    return ops
  }

  function hasNonEmptyDraft(): boolean {
    for (const state of states.values()) {
      if (state.name === "insert_blocks") {
        for (const local of state.blocks) {
          if (blockPlainText(findBlockById(editor.document, local.id))) {
            return true
          }
        }
      } else if (state.started) {
        if (blockPlainText(findBlockById(editor.document, state.id))) {
          return true
        }
      }
    }
    return false
  }

  return { applyPartial, applyComplete, synthesizeOps, hasNonEmptyDraft }
}

import type { BlockEditor } from "../block-editor"
import { generateBlockId } from "../block-schema/ids"
import type { Block, InlineContent, PartialBlock } from "../block-schema/types"
import type { AiInsertBlockInput, AiWriteOp } from "./types"

type ApplyResult = { ok: true; op: AiWriteOp } | { ok: false; reason: string }

/** 将 AI 输出的纯文本转为单段 unstyled 行内内容 */
export function textToInlineContent(text: string): InlineContent[] {
  return [{ type: "text", text, styles: {} }]
}

/** 递归扫描 document 树，判断块 id 是否存在 */
function blockExists(blocks: Block[], id: string): boolean {
  for (const block of blocks) {
    if (block.id === id) {
      return true
    }
    if (blockExists(block.children, id)) {
      return true
    }
  }
  return false
}

function insertInputToPartial(input: AiInsertBlockInput): {
  partial: PartialBlock
  id: string
} {
  const id = input.id ?? generateBlockId()
  return {
    id,
    partial: {
      id,
      type: input.type,
      props: input.props ?? {},
      content: textToInlineContent(input.text),
      children: [],
    },
  }
}

/** 将单条 AI 写作 op 应用到 BlockEditor；insert 会为无 id 的块生成 id 并写回返回 op */
export function applyAiWriteOp(
  editor: BlockEditor,
  op: AiWriteOp
): ApplyResult {
  switch (op.type) {
    case "insert_blocks": {
      if (!blockExists(editor.document, op.refId)) {
        return { ok: false, reason: "insert_blocks refId 不存在" }
      }
      const blocksWithIds: AiInsertBlockInput[] = []
      const partials = op.blocks.map((block) => {
        const { partial, id } = insertInputToPartial(block)
        blocksWithIds.push({ ...block, id })
        return partial
      })
      editor.insertBlocks(partials, op.refId, op.placement)
      return {
        ok: true,
        op: {
          type: "insert_blocks",
          refId: op.refId,
          placement: op.placement,
          blocks: blocksWithIds,
        },
      }
    }
    case "update_block": {
      if (!blockExists(editor.document, op.id)) {
        return { ok: false, reason: "update_block id 不存在" }
      }
      const update: {
        type?: Block["type"]
        props?: Record<string, unknown>
        content?: Block["content"]
      } = {}
      // blockType 映射到 BlockEditor.updateBlock 的 type 字段
      if (op.blockType !== undefined) {
        update.type = op.blockType
      }
      if (op.props !== undefined) {
        update.props = op.props
      }
      // 未传 text 则保留原有 content
      if (op.text !== undefined) {
        update.content = textToInlineContent(op.text)
      }
      editor.updateBlock(op.id, update)
      return { ok: true, op }
    }
    default: {
      return { ok: false, reason: "未知 op 类型" }
    }
  }
}

/**
 * 收集应高亮为草稿的块 id：insert 用已生成的 block.id，update 用 op.id。
 * 不含 refId（锚点不是 AI 新内容，除非该块也被 update）。
 */
export function collectAiWriteDraftIds(ops: AiWriteOp[]): string[] {
  const ids: string[] = []
  for (const op of ops) {
    if (op.type === "insert_blocks") {
      for (const block of op.blocks) {
        if (block.id) {
          ids.push(block.id)
        }
      }
    } else {
      ids.push(op.id)
    }
  }
  return ids
}

/** 收集重放前必须在 live 文档中仍存在的锚点 id（insert refId + update id） */
export function collectAiWriteOpTargetIds(ops: AiWriteOp[]): string[] {
  const ids: string[] = []
  for (const op of ops) {
    if (op.type === "insert_blocks") {
      ids.push(op.refId)
    } else {
      ids.push(op.id)
    }
  }
  return ids
}

/** 接受前检查：每条 op 的 refId / update id 是否仍在 live 文档树中 */
export function canReplayAiWriteOps(
  live: BlockEditor,
  ops: AiWriteOp[]
): boolean {
  for (const op of ops) {
    if (op.type === "insert_blocks") {
      if (!blockExists(live.document, op.refId)) {
        return false
      }
    } else if (!blockExists(live.document, op.id)) {
      return false
    }
  }
  return true
}

/** 从影子编辑器按前序遍历提取 insert/update 涉及的块（含完整子树） */
export function extractDraftBlocks(
  shadow: BlockEditor,
  ops: AiWriteOp[]
): Block[] {
  const targetIds = new Set<string>()
  for (const op of ops) {
    if (op.type === "insert_blocks") {
      for (const block of op.blocks) {
        if (block.id) {
          targetIds.add(block.id)
        }
      }
    } else {
      targetIds.add(op.id)
    }
  }

  const result: Block[] = []
  function walk(blocks: Block[]) {
    for (const block of blocks) {
      if (targetIds.has(block.id)) {
        result.push(block)
      }
      walk(block.children)
    }
  }
  walk(shadow.document)
  return result
}

import type { BlockEditor } from "@xtai-notion/editor-core"
import type {
  Block,
  PartialBlock,
} from "@xtai-notion/editor-core/model/types"
import type {
  CommentTextAnchor,
  DocumentAgentSelectionState,
} from "@xtai-notion/editor-core"
import {
  blocksToMarkdown,
  generateBlockId,
  markdownToBlocks,
} from "@xtai-notion/editor-core"
import { resolveCommentAnchorInDoc } from "@xtai-notion/editor-core/document-comment-anchor"

export type DocumentWriteAction = "insert" | "replace"

export type AgentEditorTarget =
  | { kind: "none" }
  | { kind: "cursor"; blockId: string }
  | { kind: "text"; anchor: CommentTextAnchor }
  | { kind: "blocks"; blockIds: string[]; preview: string }

function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block
    const nested = findBlockById(block.children, id)
    if (nested) return nested
  }
  return null
}

function isEmptyParagraph(block: Block | null | undefined): boolean {
  if (!block || block.type !== "paragraph") return false
  if (!Array.isArray(block.content) || block.content.length === 0) return true
  return block.content.every(
    (item) => item.type === "text" && item.text.trim() === ""
  )
}

function blockPlainText(block: Block): string {
  return blocksToMarkdown([block]).trim()
}

function ensurePartialBlockIds(blocks: Block[]): PartialBlock[] {
  return blocks.map((block) => ({
    ...block,
    id: block.id || generateBlockId(),
  }))
}

function resolveInsertRefId(editor: BlockEditor, refId: string): string | null {
  if (findBlockById(editor.document, refId)) return refId
  return editor.getActiveBlockContainerId()
}

/**
 * 逐块插入，避免 BlockEditor.insertBlocks 一次插入多块时在部分文档结构下越界。
 */
function insertBlocksSequentially(
  editor: BlockEditor,
  blocks: PartialBlock[],
  refId: string,
  initialPlacement: "before" | "after"
): { ok: true } | { ok: false; message: string } {
  let currentRef = resolveInsertRefId(editor, refId)
  if (!currentRef) {
    return { ok: false, message: "无法定位插入位置，请重新点击文档后重试" }
  }

  let placement = initialPlacement
  for (const block of blocks) {
    currentRef = resolveInsertRefId(editor, currentRef)
    if (!currentRef) {
      return { ok: false, message: "无法定位插入位置，请重新点击文档后重试" }
    }

    try {
      editor.insertBlocks([block], currentRef, placement)
    } catch {
      return { ok: false, message: "写入文档失败，请重试" }
    }

    currentRef = block.id ?? currentRef
    placement = "after"
  }

  return { ok: true }
}

/** 写入前聚焦编辑器，避免侧栏按钮抢焦点导致选区/ref 块失效。 */
export function prepareEditorForAgentWrite(editor: BlockEditor): void {
  editor.tiptap.commands.focus()
}

/** 读取当前编辑器选区，供智能体判断插入/替换目标。 */
export function readAgentEditorTarget(editor: BlockEditor): AgentEditorTarget {
  const textAnchor = editor.getCommentTextSelection()
  if (textAnchor) {
    return { kind: "text", anchor: textAnchor }
  }

  const { selection } = editor.tiptap.state
  if (!selection.empty) {
    const selected = editor.getSelectedBlocks()
    if (selected.length > 0) {
      return {
        kind: "blocks",
        blockIds: selected.map((block) => block.id),
        preview: blocksToMarkdown(selected).trim(),
      }
    }
  }

  const blockId = editor.getActiveBlockContainerId()
  if (blockId) {
    return { kind: "cursor", blockId }
  }

  return { kind: "none" }
}

export function canReplaceEditorTarget(target: AgentEditorTarget): boolean {
  return target.kind === "text" || target.kind === "blocks"
}

/** 将智能体选区目标映射为编辑器 PM 装饰状态。 */
export function toDocumentAgentSelectionTarget(
  target: AgentEditorTarget
): DocumentAgentSelectionState {
  if (target.kind === "text") {
    return {
      kind: "text",
      blockId: target.anchor.blockId,
      anchorFrom: target.anchor.anchorFrom,
      anchorTo: target.anchor.anchorTo,
    }
  }
  if (target.kind === "blocks") {
    return { kind: "blocks", blockIds: target.blockIds }
  }
  return null
}

export function describeAgentEditorTarget(target: AgentEditorTarget): string {
  if (target.kind === "text") {
    const preview = target.anchor.preview.trim()
    const label =
      preview.length > 48 ? `${preview.slice(0, 48)}…` : preview || "选中文本"
    return `已选中文本：${label}`
  }
  if (target.kind === "blocks") {
    return `已选中 ${target.blockIds.length} 个块`
  }
  if (target.kind === "cursor") {
    return "光标位置：将内容插入到当前块之后"
  }
  return "请在编辑器中定位光标或选中内容"
}

/** 根据选区与操作类型构造发给智能体的文档上下文。 */
export function buildDocumentAgentContext(
  fullText: string,
  target: AgentEditorTarget,
  action: DocumentWriteAction
): string {
  const trimmed = fullText.trim()
  if (target.kind === "text") {
    const selected = target.anchor.preview.trim()
    if (action === "replace") {
      return [
        "【选中片段】",
        selected,
        "",
        "【完整文档】",
        trimmed,
        "",
        "【要求】只输出用于替换选中片段的内容，不要重复全文或解释过程。",
      ].join("\n")
    }
    return [
      "【选中片段】",
      selected,
      "",
      "【完整文档】",
      trimmed,
      "",
      "【要求】围绕选中片段续写或补充，只输出要插入的正文。",
    ].join("\n")
  }

  if (target.kind === "blocks") {
    const selected = target.preview.trim()
    if (action === "replace") {
      return [
        "【选中块】",
        selected,
        "",
        "【完整文档】",
        trimmed,
        "",
        "【要求】只输出用于替换选中块的内容，不要重复全文或解释过程。",
      ].join("\n")
    }
    return [
      "【选中块】",
      selected,
      "",
      "【完整文档】",
      trimmed,
      "",
      "【要求】在选中块附近插入内容，只输出要插入的正文。",
    ].join("\n")
  }

  if (action === "replace") {
    return [
      "【完整文档】",
      trimmed,
      "",
      "【要求】根据任务改写文档相关部分，只输出可直接粘贴的结果。",
    ].join("\n")
  }

  return trimmed
}

function replaceTextSelection(
  editor: BlockEditor,
  anchor: CommentTextAnchor,
  markdown: string
): { ok: true } | { ok: false; message: string } {
  const range = resolveCommentAnchorInDoc(
    editor.tiptap.state.doc,
    anchor.blockId,
    anchor.anchorFrom,
    anchor.anchorTo
  )
  if (!range) {
    return { ok: false, message: "无法定位选区，请重新选中后重试" }
  }

  const parsed = ensurePartialBlockIds(markdownToBlocks(markdown.trim()))
  if (parsed.length === 0) {
    return { ok: false, message: "生成内容无法解析为 Markdown" }
  }

  const first = parsed[0]!
  const replacement = blockPlainText(first as Block)
  const tr = editor.tiptap.state.tr.insertText(
    replacement,
    range.from,
    range.to
  )
  editor.tiptap.view.dispatch(tr)

  if (parsed.length > 1) {
    return insertBlocksSequentially(
      editor,
      parsed.slice(1),
      anchor.blockId,
      "after"
    )
  }

  return { ok: true }
}

function replaceSelectedBlocks(
  editor: BlockEditor,
  blockIds: string[],
  markdown: string
): { ok: true } | { ok: false; message: string } {
  const firstId = blockIds[0]
  if (!firstId) {
    return { ok: false, message: "未选中可替换的块" }
  }

  const parsed = ensurePartialBlockIds(markdownToBlocks(markdown.trim()))
  if (parsed.length === 0) {
    return { ok: false, message: "生成内容无法解析为 Markdown" }
  }

  const inserted = insertBlocksSequentially(editor, parsed, firstId, "before")
  if (!inserted.ok) return inserted

  editor.removeBlocks(blockIds)
  return { ok: true }
}

function insertMarkdownAtBlock(
  editor: BlockEditor,
  refId: string,
  markdown: string
): { ok: true } | { ok: false; message: string } {
  const parsed = ensurePartialBlockIds(markdownToBlocks(markdown.trim()))
  if (parsed.length === 0) {
    return { ok: false, message: "生成内容无法解析为 Markdown" }
  }

  const resolvedRef = resolveInsertRefId(editor, refId)
  if (!resolvedRef) {
    return { ok: false, message: "请先将光标置于文档中" }
  }

  const current = findBlockById(editor.document, resolvedRef)
  const [first] = parsed
  if (!first) {
    return { ok: false, message: "生成内容无法解析为 Markdown" }
  }

  if (isEmptyParagraph(current ?? undefined)) {
    if (parsed.length === 1) {
      editor.updateBlock(resolvedRef, {
        type: first.type,
        props: first.props,
        content: first.content,
      })
      return { ok: true }
    }

    editor.updateBlock(resolvedRef, {
      type: first.type,
      props: first.props,
      content: first.content,
    })

    return insertBlocksSequentially(
      editor,
      parsed.slice(1),
      resolvedRef,
      "after"
    )
  }

  return insertBlocksSequentially(editor, parsed, resolvedRef, "after")
}

/** 将智能体 Markdown 结果写入当前文档（插入或替换选区/块）。 */
export function applyAgentMarkdownToEditor(
  editor: BlockEditor,
  markdown: string,
  action: DocumentWriteAction
): { ok: true } | { ok: false; message: string } {
  const content = markdown.trim()
  if (!content) {
    return { ok: false, message: "没有可写入的内容" }
  }

  prepareEditorForAgentWrite(editor)
  const liveTarget = readAgentEditorTarget(editor)

  if (action === "replace") {
    if (liveTarget.kind === "text") {
      return replaceTextSelection(editor, liveTarget.anchor, content)
    }
    if (liveTarget.kind === "blocks") {
      return replaceSelectedBlocks(editor, liveTarget.blockIds, content)
    }
  }

  const refId =
    liveTarget.kind === "cursor"
      ? liveTarget.blockId
      : liveTarget.kind === "text"
        ? liveTarget.anchor.blockId
        : liveTarget.kind === "blocks"
          ? liveTarget.blockIds[liveTarget.blockIds.length - 1]
          : editor.getActiveBlockContainerId()

  if (!refId) {
    return { ok: false, message: "请先将光标置于文档中" }
  }

  return insertMarkdownAtBlock(editor, refId, content)
}

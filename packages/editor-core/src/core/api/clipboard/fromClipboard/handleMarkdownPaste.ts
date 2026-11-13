import type { Editor } from "@tiptap/core"
import type { EditorState } from "@tiptap/pm/state"
import { pmDocToBlocks } from "../../conversions/pm-doc"
import type { Block } from "../../../model/types"
import { insertBlocks } from "../../blockManipulation/commands/insertBlocks"
import { removeBlocks } from "../../blockManipulation/commands/removeBlocks"
import { updateBlock } from "../../blockManipulation/commands/updateBlock"
import { getActiveBlockContainerId } from "../../blockManipulation/selections/getActiveBlockContainerId"
import { findBlockById } from "../../blockManipulation/tree"
import { looksLikeMarkdown } from "../../parsers/markdown/detect"
import { markdownToBlocks } from "../../parsers/markdown/parseMarkdown"

function selectionIsInCodeBlock(state: EditorState): boolean {
  const $from = state.selection.$from
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "codeBlock") {
      return true
    }
  }
  return false
}

function isEmptyParagraph(block: Block | undefined): boolean {
  if (!block || block.type !== "paragraph") {
    return false
  }
  if (!Array.isArray(block.content) || block.content.length === 0) {
    return true
  }
  return block.content.every(
    (item) => item.type === "text" && item.text.trim() === ""
  )
}

/**
 * 纯 Markdown 粘贴转成块。返回 true 表示已消费 paste。
 * 调用方须先处理表格单元格 JSON 粘贴。
 */
export function handleMarkdownPaste(
  editor: Editor,
  event: ClipboardEvent
): boolean {
  if (selectionIsInCodeBlock(editor.state)) {
    return false
  }

  const plain = event.clipboardData?.getData("text/plain") ?? ""
  if (!looksLikeMarkdown(plain)) {
    return false
  }

  // plain 已是 Markdown 时始终走块解析；富文本 HTML（预览页/聊天复制）会误触发
  // clipboardHtmlHasRichStructure，默认 HTML 粘贴又无法映射到块 schema，只会留下原文

  const parsed = markdownToBlocks(plain)
  if (parsed.length === 0) {
    return false
  }

  const refId = getActiveBlockContainerId(editor)
  if (!refId) {
    return false
  }

  const document = pmDocToBlocks(editor.state.doc)
  const current = findBlockById(document, refId)
  const [first] = parsed
  if (!first) {
    return false
  }

  if (isEmptyParagraph(current ?? undefined)) {
    if (parsed.length === 1) {
      updateBlock(editor, refId, {
        type: first.type,
        props: first.props,
        content: first.content,
      })
      return true
    }
    // 单块文档无法在块后安全 insert；先插入整段 Markdown 再移除空段落
    insertBlocks(editor, parsed, refId, "before")
    removeBlocks(editor, [refId])
    return true
  }

  insertBlocks(editor, parsed, refId, "after")
  return true
}

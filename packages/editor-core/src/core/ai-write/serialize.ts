import type { Block, InlineContent } from "../block-schema/types"
import type { AiBlockView } from "./types"
import { isAiWritableBlockType } from "./types"

/** 拼接行内纯文本：text 节点取 text，mention 取 label，link 递归子节点 */
function inlineToPlainText(content: InlineContent[]): string {
  let text = ""
  for (const item of content) {
    if (item.type === "text") {
      text += item.text
    } else if (item.type === "mention") {
      text += item.label
    } else if (item.type === "link") {
      text += inlineToPlainText(item.content)
    }
  }
  return text
}

function blockToAiBlockView(block: Block): AiBlockView {
  const text = Array.isArray(block.content)
    ? inlineToPlainText(block.content)
    : ""

  return {
    id: block.id,
    type: block.type,
    text,
    writable: isAiWritableBlockType(block.type),
    children: blocksToAiBlockViews(block.children),
  }
}

/** 将 Block 树转为 AI 精简视图，供模型理解文档结构与定位 refId */
export function blocksToAiBlockViews(blocks: Block[]): AiBlockView[] {
  return blocks.map(blockToAiBlockView)
}

/** 收集精简视图中的全部块 id，用于校验 refId / update id 是否仍存在于快照 */
export function collectAiBlockIds(views: AiBlockView[]): Set<string> {
  const ids = new Set<string>()

  const visit = (items: AiBlockView[]) => {
    for (const view of items) {
      ids.add(view.id)
      visit(view.children)
    }
  }

  visit(views)
  return ids
}

/** 判断是否为「空文本块」：仅有空白字符的行内内容（slash 模式可替换光标段落） */
export function isEmptyTextBlock(block: Block): boolean {
  if (!Array.isArray(block.content)) {
    return false
  }
  return inlineToPlainText(block.content).trim().length === 0
}

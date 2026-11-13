import type { Editor } from "@tiptap/core"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import { pmDocToBlocks } from "../../conversions/pm-doc"
import type { Block } from "../../../model/types"
import { blockToContainerNode } from "../../conversions/partialBlock"
import { findContainerById } from "../../nodeUtil"
import { findBlockById } from "../tree"

/** 合并更新并替换整块 blockContainer；找不到 id 时静默返回 */
export function updateBlock(
  editor: Editor,
  id: string,
  update: {
    type?: Block["type"]
    props?: Record<string, unknown>
    content?: Block["content"]
  }
): void {
  const ref = findContainerById(editor.state.doc, id)
  if (!ref) {
    return
  }

  const blocks = pmDocToBlocks(editor.state.doc)
  const existing = findBlockById(blocks, id)
  if (!existing) {
    return
  }

  const merged: Block = {
    ...existing,
    type: update.type ?? existing.type,
    props: update.props ?? existing.props,
    content: update.content !== undefined ? update.content : existing.content,
    id: existing.id,
  }

  const newContainer = blockToContainerNode(merged, editor.schema)
  let tr = editor.state.tr.replaceWith(
    ref.pos,
    ref.pos + ref.node.nodeSize,
    newContainer
  )

  // 原子块（画板/分割线/图片）替换后把选区落到合法位置，避免协作层同步越界 cursor
  const mappedPos = tr.mapping.map(ref.pos)
  const inserted = tr.doc.nodeAt(mappedPos)
  const contentNode = inserted?.child(0)
  if (contentNode) {
    const atomTypes = new Set(["canvas", "divider", "image"])
    if (atomTypes.has(contentNode.type.name)) {
      tr.setSelection(NodeSelection.create(tr.doc, mappedPos + 1))
    } else if (contentNode.isTextblock) {
      tr.setSelection(
        TextSelection.create(tr.doc, mappedPos + 1 + contentNode.nodeSize - 1)
      )
    }
  }

  editor.view.dispatch(tr)
}

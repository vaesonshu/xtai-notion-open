import type { Editor } from "@tiptap/core"
import { pmDocToBlocks } from "../../conversions/pm-doc"
import type { Block } from "../../../model/types"

/** 收集当前选区覆盖到的顶层 Block 快照（含嵌套子树内命中项） */
export function getSelectedBlocks(editor: Editor): Block[] {
  const { from, to } = editor.state.selection
  const selectedIds = new Set<string>()

  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === "blockContainer") {
      selectedIds.add(node.attrs.id as string)
    }
  })

  const document = pmDocToBlocks(editor.state.doc)
  const result: Block[] = []
  const collect = (blocks: Block[]) => {
    for (const block of blocks) {
      if (selectedIds.has(block.id)) {
        result.push(block)
      }
      collect(block.children)
    }
  }
  collect(document)
  return result
}

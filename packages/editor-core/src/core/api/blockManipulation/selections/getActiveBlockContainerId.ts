import type { Editor } from "@tiptap/core"
import { getSelectedBlocks } from "./getSelectedBlocks"

/** 解析当前选区所在的 blockContainer id（折叠光标也可用） */
export function getActiveBlockContainerId(editor: Editor): string | null {
  const state = editor.state
  if (!state.selection.empty) {
    const selected = getSelectedBlocks(editor)
    if (selected[0]?.id) {
      return selected[0].id
    }
  }

  const { from } = state.selection
  const $pos = state.doc.resolve(from)
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (node.type.name === "blockContainer") {
      return node.attrs.id as string
    }
  }
  return null
}

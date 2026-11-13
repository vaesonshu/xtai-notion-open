import type { Editor } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { blocksToPmDoc, pmDocToBlocks } from "../../conversions/pm-doc"
import { createEmptyBlocks } from "../../../model/documents"

/** 按 id 删除 blockContainer；删光后补一块空段落 */
export function removeBlocks(editor: Editor, ids: string[]): void {
  const idSet = new Set(ids)
  let tr = editor.state.tr

  const toRemove: { pos: number; node: PMNode }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (
      node.type.name === "blockContainer" &&
      idSet.has(node.attrs.id as string)
    ) {
      toRemove.push({ pos, node })
    }
  })

  toRemove
    .sort((a, b) => b.pos - a.pos)
    .forEach(({ pos, node }) => {
      tr = tr.delete(tr.mapping.map(pos), tr.mapping.map(pos) + node.nodeSize)
    })

  if (toRemove.length > 0) {
    editor.view.dispatch(tr)
  }

  if (pmDocToBlocks(editor.state.doc).length === 0) {
    const empty = createEmptyBlocks()
    const doc = blocksToPmDoc(empty, editor.schema)
    editor.commands.setContent(doc.toJSON())
  }
}

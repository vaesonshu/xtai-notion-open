import type { Editor } from "@tiptap/core"
import type { PartialBlock } from "../../../model/types"
import {
  blockToContainerNode,
  normalizePartialBlock,
} from "../../conversions/partialBlock"
import {
  findContainerById,
  insertPosAfterContainer,
  requireNodeType,
} from "../../nodeUtil"

/** 在参考块前/后/子级插入一批块并 dispatch */
export function insertBlocks(
  editor: Editor,
  blocks: PartialBlock[],
  refId: string,
  placement: "before" | "after" | "nested"
): void {
  const ref = findContainerById(editor.state.doc, refId)
  if (!ref) {
    return
  }

  const normalized = blocks.map(normalizePartialBlock)
  const nodes = normalized.map((block) =>
    blockToContainerNode(block, editor.schema)
  )

  let tr = editor.state.tr

  if (placement === "nested") {
    const contentNode = ref.node.child(0)
    let insertPos = ref.pos + 1 + contentNode.nodeSize

    if (ref.node.childCount > 1) {
      const childGroup = ref.node.child(1)
      insertPos = ref.pos + 1 + contentNode.nodeSize + childGroup.content.size
      for (const node of nodes) {
        tr.insert(tr.mapping.map(insertPos), node)
        insertPos += node.nodeSize
      }
    } else {
      const group = requireNodeType(editor.schema, "blockGroup").create(
        null,
        nodes
      )
      tr.insert(tr.mapping.map(insertPos), group)
    }
  } else if (placement === "before") {
    const insertPos = ref.pos
    for (const node of nodes) {
      tr.insert(tr.mapping.map(insertPos), node)
    }
  } else {
    let insertPos = insertPosAfterContainer(tr.doc, ref)
    for (const node of nodes) {
      const mappedPos = tr.mapping.map(insertPos)
      tr.insert(mappedPos, node)
      insertPos = mappedPos + node.nodeSize
    }
  }

  editor.view.dispatch(tr)
}

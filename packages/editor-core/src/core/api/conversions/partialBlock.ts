import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState } from "@tiptap/pm/state"
import { blocksToPmDoc } from "../../block-schema/convert"
import { generateBlockId } from "../../block-schema/ids"
import type { Block, PartialBlock } from "../../block-schema/types"

/** 将 PartialBlock 补全为可写入 PM 的 Block */
export function normalizePartialBlock(partial: PartialBlock): Block {
  return {
    id: partial.id ?? generateBlockId(),
    type: partial.type,
    props: partial.props ?? {},
    content: partial.content,
    children: partial.children ?? [],
  }
}

/** 单块 → blockContainer PM 节点（复用 blocksToPmDoc 保证与 convert 一致） */
export function blockToContainerNode(
  block: Block,
  schema: EditorState["schema"]
): PMNode {
  const doc = blocksToPmDoc([block], schema)
  const group = doc.firstChild
  if (!group?.firstChild) {
    throw new Error("blocksToPmDoc produced an empty container")
  }
  return group.firstChild
}

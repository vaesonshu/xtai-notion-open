import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { generateBlockId, MAX_NEST_DEPTH } from "../../block-schema/ids"
import type { ContainerRef } from "../nodeUtil"
import {
  findContainerAtSelection,
  findPreviousSiblingContainer,
  hasParentContainer,
  requireNodeType,
} from "../nodeUtil"

/** 将 blockContainer 节点移动到文档中的目标位置（自动处理 mapping） */
export function moveContainer(
  tr: Transaction,
  fromPos: number,
  node: PMNode,
  toPos: number
): Transaction {
  tr.delete(fromPos, fromPos + node.nodeSize)
  const mappedTo = tr.mapping.map(toPos)
  tr.insert(mappedTo, node)
  return tr
}

/** 在上一个同级 blockContainer 的 children 末尾插入当前块 */
export function nestContainerInPreviousSibling(
  state: EditorState,
  current: ContainerRef,
  previous: ContainerRef
): Transaction | null {
  const { schema } = state
  const movedNode = current.node

  if (previous.depth + 1 > MAX_NEST_DEPTH) {
    return null
  }

  let tr = state.tr
  const contentNode = previous.node.child(0)

  if (previous.node.childCount > 1) {
    const childGroup = previous.node.child(1)
    const insertPos =
      previous.pos + 1 + contentNode.nodeSize + childGroup.content.size
    tr = moveContainer(tr, current.pos, movedNode, insertPos)
    return tr
  }

  tr.delete(current.pos, current.pos + movedNode.nodeSize)
  const mappedPrevPos = tr.mapping.map(previous.pos)
  const mappedPrevNode = tr.doc.nodeAt(mappedPrevPos)
  if (!mappedPrevNode) {
    return null
  }

  const group = requireNodeType(schema, "blockGroup").create(null, [movedNode])
  const mappedContent = mappedPrevNode.child(0)
  const groupInsertPos = mappedPrevPos + 1 + mappedContent.nodeSize
  tr.insert(groupInsertPos, group)
  return tr
}

/**
 * 无同级可嵌套时，在父块内为当前块包一层 blockContainer，等价于再缩进一级。
 * 仅当已有父 blockContainer 且未超深度上限时生效。
 */
export function wrapContainerDeeper(
  state: EditorState,
  current: ContainerRef
): Transaction | null {
  if (current.depth + 1 > MAX_NEST_DEPTH) {
    return null
  }
  if (!hasParentContainer(state.doc, current.pos)) {
    return null
  }

  const { schema } = state
  const wrapper = requireNodeType(schema, "blockContainer").create(
    { id: generateBlockId() },
    [
      requireNodeType(schema, "paragraph").create(),
      requireNodeType(schema, "blockGroup").create(null, [current.node]),
    ]
  )

  return state.tr.replaceWith(
    current.pos,
    current.pos + current.node.nodeSize,
    wrapper
  )
}

/** 将块升到父 blockContainer 之后（整棵子树一起移动） */
export function unnestContainer(
  state: EditorState,
  current: ContainerRef
): Transaction | null {
  const $pos = state.doc.resolve(current.pos + 1)
  let containerDepth = -1

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "blockContainer") {
      containerDepth = depth
      break
    }
  }

  if (containerDepth <= 0) {
    return null
  }

  let parentContainerDepth = -1
  for (let depth = containerDepth - 1; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "blockContainer") {
      parentContainerDepth = depth
      break
    }
  }

  if (parentContainerDepth <= 0) {
    return null
  }

  const parentPos = $pos.before(parentContainerDepth)
  const parentNode = $pos.node(parentContainerDepth)
  const currentPos = $pos.before(containerDepth)
  const currentNode = $pos.node(containerDepth)
  const insertPos = parentPos + parentNode.nodeSize

  let tr = state.tr
  tr = moveContainer(tr, currentPos, currentNode, insertPos)
  return tr
}

/** 根据当前选区构建「缩进块」事务；无操作可能时返回 null */
export function buildNestBlockTransaction(
  state: EditorState
): Transaction | null {
  const current = findContainerAtSelection(state)
  if (!current) {
    return null
  }

  const previous = findPreviousSiblingContainer(state.doc, current.pos)
  return previous
    ? nestContainerInPreviousSibling(state, current, previous)
    : wrapContainerDeeper(state, current)
}

/** 根据当前选区构建「反缩进块」事务；无操作可能时返回 null */
export function buildUnnestBlockTransaction(
  state: EditorState
): Transaction | null {
  const current = findContainerAtSelection(state)
  if (!current) {
    return null
  }

  return unnestContainer(state, current)
}

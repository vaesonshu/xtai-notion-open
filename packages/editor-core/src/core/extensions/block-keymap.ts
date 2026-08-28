import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { TextSelection } from "@tiptap/pm/state"
import { BLOCK_CONTENT_NODE_NAMES } from "../block-schema/block-content"
import { generateBlockId } from "../block-schema/ids"
import type { BlockType } from "../block-schema/types"

const BLOCK_CONTENT_TYPES = new Set<string>(BLOCK_CONTENT_NODE_NAMES)

/** 不可拆分的原子块：Enter 时在下方插入新段落 */
const ATOM_BLOCK_TYPES = new Set(["divider", "image", "canvas"])

type ContainerRef = {
  pos: number
  node: PMNode
}

function requireNodeType(schema: EditorState["schema"], name: string) {
  const nodeType = schema.nodes[name]
  if (!nodeType) {
    throw new Error(`Missing block schema node: ${name}`)
  }
  return nodeType
}

/** 从选区向上找到所在的 blockContainer */
function findContainerAtSelection(state: EditorState): ContainerRef | null {
  const { from } = state.selection
  const $pos = state.doc.resolve(from)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (node.type.name === "blockContainer") {
      return { pos: $pos.before(depth), node }
    }
  }

  return null
}

/** 找到上一个同级 blockContainer */
function findPreviousSiblingContainer(
  doc: PMNode,
  containerPos: number
): ContainerRef | null {
  const $pos = doc.resolve(containerPos)
  if ($pos.index() === 0) {
    return null
  }

  const parent = $pos.parent
  const prevNode = parent.child($pos.index() - 1)
  if (prevNode.type.name !== "blockContainer") {
    return null
  }

  const prevPos = containerPos - prevNode.nodeSize
  return { pos: prevPos, node: prevNode }
}

function isContentEmpty(contentNode: PMNode): boolean {
  return contentNode.content.size === 0
}

function getInlineOffset(state: EditorState, container: ContainerRef): number {
  const contentNode = container.node.child(0)
  const innerStart = container.pos + 2
  const { from } = state.selection

  if (from <= innerStart) {
    return 0
  }

  return Math.min(from - innerStart, contentNode.content.size)
}

/** 在 blockContainer 之后插入新块；list 项保持同类型，其余默认为段落 */
function createBlockAfterType(contentNode: PMNode): BlockType {
  const typeName = contentNode.type.name
  if (
    typeName === "bulletListItem" ||
    typeName === "numberedListItem" ||
    typeName === "checkListItem"
  ) {
    return typeName
  }
  return "paragraph"
}

function buildContentNode(
  schema: EditorState["schema"],
  type: BlockType,
  source: PMNode,
  content: PMNode["content"]
): PMNode {
  switch (type) {
    case "heading":
      return requireNodeType(schema, "heading").create(source.attrs, content)
    case "checkListItem":
      return requireNodeType(schema, "checkListItem").create(
        source.attrs,
        content
      )
    case "quote":
      return requireNodeType(schema, "quote").create(source.attrs, content)
    case "codeBlock":
      return requireNodeType(schema, "codeBlock").create(source.attrs, content)
    case "bulletListItem":
    case "numberedListItem":
    case "paragraph":
      return requireNodeType(schema, type).create(source.attrs, content)
    default:
      return requireNodeType(schema, "paragraph").create(null, content)
  }
}

function buildContainer(
  schema: EditorState["schema"],
  contentNode: PMNode,
  childGroup?: PMNode
): PMNode {
  const children = childGroup
    ? [contentNode, childGroup]
    : [contentNode]
  return requireNodeType(schema, "blockContainer").create(
    { id: generateBlockId() },
    children
  )
}

/** 在当前 blockContainer 之后插入空块 */
function insertBlockAfter(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  current: ContainerRef,
  options: { type?: BlockType } = {}
): boolean {
  const { schema } = state
  const sourceContent = current.node.child(0)
  const blockType = options.type ?? createBlockAfterType(sourceContent)
  const contentNode = buildContentNode(schema, blockType, sourceContent, [])
  const newContainer = buildContainer(schema, contentNode)
  const insertPos = current.pos + current.node.nodeSize

  const tr = state.tr.insert(insertPos, newContainer)
  // 光标落在新块行首
  tr.setSelection(TextSelection.create(tr.doc, insertPos + 2))
  dispatch(tr.scrollIntoView())
  return true
}

/** 在光标处拆分 blockContainer：前半保留原 id，后半生成新块 */
function splitBlockAtCursor(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  current: ContainerRef
): boolean {
  const { schema } = state
  const contentNode = current.node.child(0)
  const offset = getInlineOffset(state, current)
  const before = contentNode.content.cut(0, offset)
  const after = contentNode.content.cut(offset)
  const childGroup =
    current.node.childCount > 1 ? current.node.child(1) : undefined

  const beforeContent = buildContentNode(
    schema,
    contentNode.type.name as BlockType,
    contentNode,
    before
  )
  const afterContent = buildContentNode(
    schema,
    contentNode.type.name as BlockType,
    contentNode,
    after
  )

  const beforeContainer = requireNodeType(schema, "blockContainer").create(
    current.node.attrs,
    childGroup ? [beforeContent, childGroup] : [beforeContent]
  )
  const afterContainer = buildContainer(schema, afterContent)

  const tr = state.tr.replaceWith(
    current.pos,
    current.pos + current.node.nodeSize,
    [beforeContainer, afterContainer]
  )
  tr.setSelection(TextSelection.create(tr.doc, current.pos + beforeContainer.nodeSize + 2))
  dispatch(tr.scrollIntoView())
  return true
}

function handleEnter(state: EditorState, dispatch?: (tr: Transaction) => void) {
  if (!dispatch || !state.selection.empty) {
    return false
  }

  const current = findContainerAtSelection(state)
  if (!current) {
    return false
  }

  const contentNode = current.node.child(0)
  const typeName = contentNode.type.name

  // 表格与代码块沿用 PM 默认行为（单元格导航 / 代码内换行）
  if (typeName === "table" || typeName === "codeBlock") {
    return false
  }

  if (ATOM_BLOCK_TYPES.has(typeName)) {
    return insertBlockAfter(state, dispatch, current)
  }

  const offset = getInlineOffset(state, current)
  const isEmpty = isContentEmpty(contentNode)
  const atEnd = offset >= contentNode.content.size

  if (isEmpty || atEnd) {
    return insertBlockAfter(state, dispatch, current)
  }

  return splitBlockAtCursor(state, dispatch, current)
}

function appendInlineContent(
  schema: EditorState["schema"],
  target: PMNode,
  source: PMNode
): PMNode {
  if (!BLOCK_CONTENT_TYPES.has(target.type.name)) {
    return target
  }

  if (target.type.name === "codeBlock") {
    const merged = target.content.append(source.content)
    return target.type.create(target.attrs, merged)
  }

  return target.type.create(
    target.attrs,
    target.content.append(source.content)
  )
}

function handleBackspace(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) {
  if (!dispatch || !state.selection.empty) {
    return false
  }

  const current = findContainerAtSelection(state)
  if (!current) {
    return false
  }

  const contentNode = current.node.child(0)
  const offset = getInlineOffset(state, current)

  if (offset > 0) {
    return false
  }

  const { schema, doc } = state

  // 行首 Backspace：空块则删除；否则与上一同级块合并行内内容
  if (isContentEmpty(contentNode)) {
    const rootGroup = doc.firstChild
    const blockCount =
      rootGroup?.type.name === "blockGroup" ? rootGroup.childCount : 0
    if (blockCount <= 1) {
      return true
    }

    const previous = findPreviousSiblingContainer(doc, current.pos)
    const tr = state.tr.delete(current.pos, current.pos + current.node.nodeSize)
    const focusPos = previous
      ? previous.pos + previous.node.nodeSize - 2
      : 1
    tr.setSelection(TextSelection.create(tr.doc, Math.max(1, focusPos)))
    dispatch(tr.scrollIntoView())
    return true
  }

  const previous = findPreviousSiblingContainer(doc, current.pos)
  if (!previous) {
    return false
  }

  const prevContent = previous.node.child(0)
  if (ATOM_BLOCK_TYPES.has(prevContent.type.name)) {
    return false
  }

  const mergedContent = appendInlineContent(schema, prevContent, contentNode)
  const prevChildGroup =
    previous.node.childCount > 1 ? previous.node.child(1) : undefined
  const currentChildGroup =
    current.node.childCount > 1 ? current.node.child(1) : undefined

  let mergedChildren: PMNode[] = [mergedContent]
  if (prevChildGroup && currentChildGroup) {
    const nestedContainers: PMNode[] = []
    prevChildGroup.forEach((node) => nestedContainers.push(node))
    currentChildGroup.forEach((node) => nestedContainers.push(node))
    mergedChildren.push(
      requireNodeType(schema, "blockGroup").create(null, nestedContainers)
    )
  } else if (prevChildGroup) {
    mergedChildren.push(prevChildGroup)
  } else if (currentChildGroup) {
    mergedChildren.push(currentChildGroup)
  }

  const mergedContainer = requireNodeType(schema, "blockContainer").create(
    previous.node.attrs,
    mergedChildren
  )

  const tr = state.tr.replaceWith(
    previous.pos,
    current.pos + current.node.nodeSize,
    mergedContainer
  )
  const focusPos = previous.pos + mergedContent.nodeSize - 1
  tr.setSelection(TextSelection.create(tr.doc, Math.max(1, focusPos)))
  dispatch(tr.scrollIntoView())
  return true
}

/**
 * 块文档键盘映射：Enter 拆块/新建块，Backspace 合并或删除空块。
 * StarterKit 禁用了 paragraph 等节点，必须在此接管块级换行逻辑。
 */
export const BlockKeymap = Extension.create({
  name: "blockKeymap",

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => handleEnter(editor.state, editor.view.dispatch),
      Backspace: ({ editor }) =>
        handleBackspace(editor.state, editor.view.dispatch),
    }
  },
})

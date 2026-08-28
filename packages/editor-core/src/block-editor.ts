import { Editor } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { blocksToPmDoc, pmDocToBlocks } from "./block-schema/convert"
import { createEmptyBlocks } from "./block-schema/documents"
import { generateBlockId, MAX_NEST_DEPTH } from "./block-schema/ids"
import { handleTableBlockPaste } from "./block-schema/table-paste"
import type { Block, PartialBlock } from "./block-schema/types"
import { createBlockSchemaExtensions } from "./extensions"
import type { EditorExtensionOptions } from "./types"

type BlockEditorOptions = {
  initialContent?: Block[]
  editable?: boolean
  extensions?: EditorExtensionOptions
  /** 协作模式下远端已有内容时应为 false，避免覆盖 Y.Doc */
  applyInitialContent?: boolean
}

type ContainerRef = {
  pos: number
  node: PMNode
  depth: number
}

/** 块 schema 必备节点，缺失时尽早抛错便于调试 */
function requireNodeType(schema: EditorState["schema"], name: string) {
  const nodeType = schema.nodes[name]
  if (!nodeType) {
    throw new Error(`Missing block schema node: ${name}`)
  }
  return nodeType
}

/** 将 PartialBlock 补全为可写入 PM 的 Block */
function normalizePartialBlock(partial: PartialBlock): Block {
  return {
    id: partial.id ?? generateBlockId(),
    type: partial.type,
    props: partial.props ?? {},
    content: partial.content,
    children: partial.children ?? [],
  }
}

/** 单块 → blockContainer PM 节点（复用 blocksToPmDoc 保证与 convert 一致） */
function blockToContainerNode(
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

/** 块在树中的深度（根块为 0，MAX_NEST_DEPTH 限制的是嵌套后深度上界） */
function getContainerDepth(doc: PMNode, containerPos: number): number {
  const $pos = doc.resolve(containerPos + 1)
  let depth = 0
  for (let level = 1; level <= $pos.depth; level += 1) {
    if ($pos.node(level).type.name === "blockContainer") {
      depth += 1
    }
  }
  return Math.max(0, depth - 1)
}

/** 按 id 查找 blockContainer 在文档中的位置 */
function findContainerById(doc: PMNode, id: string): ContainerRef | null {
  let match: ContainerRef | null = null

  doc.descendants((node, pos) => {
    if (match) {
      return false
    }
    if (node.type.name === "blockContainer" && node.attrs.id === id) {
      match = {
        pos,
        node,
        depth: getContainerDepth(doc, pos),
      }
      return false
    }
    return undefined
  })

  return match
}

/** 从选区位置向上找到所在的 blockContainer */
function findContainerAtSelection(state: EditorState): ContainerRef | null {
  const { from } = state.selection
  const $pos = state.doc.resolve(from)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (node.type.name === "blockContainer") {
      const pos = $pos.before(depth)
      return {
        pos,
        node,
        depth: getContainerDepth(state.doc, pos),
      }
    }
  }

  return null
}

/** 同一 blockGroup 内的上一个 blockContainer */
function findPreviousSiblingContainer(
  doc: PMNode,
  containerPos: number
): ContainerRef | null {
  const $pos = doc.resolve(containerPos)
  const index = $pos.index()
  if (index === 0) {
    return null
  }

  const parent = $pos.parent
  const prevNode = parent.child(index - 1)
  if (prevNode.type.name !== "blockContainer") {
    return null
  }

  const prevPos = containerPos - prevNode.nodeSize
  return {
    pos: prevPos,
    node: prevNode,
    depth: getContainerDepth(doc, prevPos),
  }
}

/** 当前块是否位于某个父 blockContainer 的 blockGroup 内 */
function hasParentContainer(doc: PMNode, containerPos: number): boolean {
  const $pos = doc.resolve(containerPos + 1)
  for (let depth = $pos.depth - 1; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name !== "blockContainer") {
      continue
    }
    if (
      depth + 1 <= $pos.depth &&
      $pos.node(depth + 1).type.name === "blockGroup"
    ) {
      return true
    }
  }
  return false
}

/** 将 blockContainer 节点移动到文档中的目标位置（自动处理 mapping） */
function moveContainer(
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
function nestContainerInPreviousSibling(
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
function wrapContainerDeeper(
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
function unnestContainer(
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

/**
 * 块文档门面：对外暴露 Block[] 与块级命令，内部持有 Tiptap/PM 实例。
 * tiptap getter 仅供 React NodeView / 协作层内部使用。
 */
export class BlockEditor {
  private readonly editor: Editor

  constructor(options: BlockEditorOptions = {}) {
    const extensionOptions = options.extensions ?? {}
    this.editor = new Editor({
      extensions: createBlockSchemaExtensions(extensionOptions),
      editable: options.editable ?? true,
      editorProps: {
        handleKeyDown: (_view, event) => {
          if (
            event.key === "Tab" &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey
          ) {
            event.preventDefault()
            if (event.shiftKey) {
              this.unnestBlock()
            } else {
              this.nestBlock()
            }
            return true
          }
          return false
        },
        // 表格单元格内粘贴块 JSON 时压成纯文本，避免嵌套块结构
        handlePaste: (view, event) => handleTableBlockPaste(view, event),
      },
      // Next.js 需显式关闭首帧渲染，避免 SSR/水合与软导航后正文空白
      immediatelyRender: false,
    } as ConstructorParameters<typeof Editor>[0])

    if (options.applyInitialContent !== false) {
      const initialBlocks = options.initialContent ?? createEmptyBlocks()
      const doc = blocksToPmDoc(initialBlocks, this.editor.schema)
      this.editor.commands.setContent(doc.toJSON())
    }
  }

  get document(): Block[] {
    return pmDocToBlocks(this.editor.state.doc)
  }

  /** @internal React NodeView / 协作绑定使用，不从包根导出 */
  get tiptap(): Editor {
    return this.editor
  }

  insertBlocks(
    blocks: PartialBlock[],
    refId: string,
    placement: "before" | "after" | "nested"
  ): void {
    const ref = findContainerById(this.editor.state.doc, refId)
    if (!ref) {
      return
    }

    const normalized = blocks.map(normalizePartialBlock)
    const nodes = normalized.map((block) =>
      blockToContainerNode(block, this.editor.schema)
    )

    let tr = this.editor.state.tr

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
        const group = requireNodeType(this.editor.schema, "blockGroup").create(
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
      let insertPos = ref.pos + ref.node.nodeSize
      for (const node of nodes) {
        tr.insert(tr.mapping.map(insertPos), node)
        insertPos += node.nodeSize
      }
    }

    this.editor.view.dispatch(tr)
  }

  updateBlock(
    id: string,
    update: {
      type?: Block["type"]
      props?: Record<string, unknown>
      content?: Block["content"]
    }
  ): void {
    const ref = findContainerById(this.editor.state.doc, id)
    if (!ref) {
      return
    }

    const blocks = pmDocToBlocks(this.editor.state.doc)

    const findBlock = (items: Block[]): Block | null => {
      for (const item of items) {
        if (item.id === id) {
          return item
        }
        const nested = findBlock(item.children)
        if (nested) {
          return nested
        }
      }
      return null
    }

    const existing = findBlock(blocks)
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

    const newContainer = blockToContainerNode(merged, this.editor.schema)
    const tr = this.editor.state.tr.replaceWith(
      ref.pos,
      ref.pos + ref.node.nodeSize,
      newContainer
    )
    this.editor.view.dispatch(tr)
  }

  removeBlocks(ids: string[]): void {
    const idSet = new Set(ids)
    let tr = this.editor.state.tr

    const toRemove: { pos: number; node: PMNode }[] = []
    this.editor.state.doc.descendants((node, pos) => {
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
      this.editor.view.dispatch(tr)
    }
  }

  nestBlock(): boolean {
    const state = this.editor.state
    const current = findContainerAtSelection(state)
    if (!current) {
      return false
    }

    const previous = findPreviousSiblingContainer(state.doc, current.pos)
    const tr = previous
      ? nestContainerInPreviousSibling(state, current, previous)
      : wrapContainerDeeper(state, current)

    if (!tr) {
      return false
    }

    this.editor.view.dispatch(tr)
    return true
  }

  unnestBlock(): boolean {
    const state = this.editor.state
    const current = findContainerAtSelection(state)
    if (!current) {
      return false
    }

    const tr = unnestContainer(state, current)
    if (!tr) {
      return false
    }

    this.editor.view.dispatch(tr)
    return true
  }

  getSelectedBlocks(): Block[] {
    const { from, to } = this.editor.state.selection
    const selectedIds = new Set<string>()

    this.editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name === "blockContainer") {
        selectedIds.add(node.attrs.id as string)
      }
    })

    const result: Block[] = []
    const collect = (blocks: Block[]) => {
      for (const block of blocks) {
        if (selectedIds.has(block.id)) {
          result.push(block)
        }
        collect(block.children)
      }
    }
    collect(this.document)
    return result
  }

  onChange(listener: (blocks: Block[]) => void): () => void {
    const handler = () => {
      listener(this.document)
    }
    this.editor.on("update", handler)
    return () => {
      this.editor.off("update", handler)
    }
  }

  setEditable(editable: boolean): void {
    this.editor.setEditable(editable)
  }

  destroy(): void {
    this.editor.destroy()
  }
}

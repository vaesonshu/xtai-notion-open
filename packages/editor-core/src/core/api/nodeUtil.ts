import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState } from "@tiptap/pm/state"

/** blockContainer 在 PM 文档中的定位信息，供块操纵命令复用 */
export type ContainerRef = {
  pos: number
  node: PMNode
  depth: number
}

/** 块 schema 必备节点，缺失时尽早抛错便于调试 */
export function requireNodeType(schema: EditorState["schema"], name: string) {
  const nodeType = schema.nodes[name]
  if (!nodeType) {
    throw new Error(`Missing block schema node: ${name}`)
  }
  return nodeType
}

/** 块在树中的深度（根块为 0，MAX_NEST_DEPTH 限制的是嵌套后深度上界） */
export function getContainerDepth(doc: PMNode, containerPos: number): number {
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
export function findContainerById(
  doc: PMNode,
  id: string
): ContainerRef | null {
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

/** 在 blockGroup 内紧挨 ref 块之后插入 sibling 的位置（单块文档也能用） */
export function insertPosAfterContainer(
  doc: PMNode,
  ref: ContainerRef
): number {
  const $inside = doc.resolve(Math.min(ref.pos + 1, doc.content.size))
  for (let depth = $inside.depth; depth > 0; depth -= 1) {
    if ($inside.node(depth).type.name === "blockContainer") {
      return $inside.after(depth)
    }
  }
  return ref.pos + ref.node.nodeSize
}

/** 从选区位置向上找到所在的 blockContainer */
export function findContainerAtSelection(
  state: EditorState
): ContainerRef | null {
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
export function findPreviousSiblingContainer(
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
export function hasParentContainer(doc: PMNode, containerPos: number): boolean {
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

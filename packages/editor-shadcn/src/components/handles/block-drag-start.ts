import type { Editor } from "@tiptap/core"
import type { Node } from "@tiptap/pm/model"
import { NodeSelection } from "@tiptap/pm/state"

/** 克隆块 DOM 作为拖拽预览图 */
function cloneBlockElement(node: HTMLElement) {
  const cloned = node.cloneNode(true) as HTMLElement
  cloned.style.margin = "0"
  return cloned
}

/** 启动 blockContainer 拖拽：选中块节点并设置 ProseMirror 拖拽状态 */
export function startBlockContainerDrag(
  event: DragEvent,
  editor: Editor,
  blockPos: number,
  blockNode: Node
) {
  const { view } = editor

  if (!event.dataTransfer) {
    return
  }

  const from = blockPos
  const slice = view.state.doc.slice(from, from + blockNode.nodeSize)
  const selection = NodeSelection.create(view.state.doc, from)
  const blockElement = view.nodeDOM(from)

  if (blockElement instanceof HTMLElement) {
    const wrapper = document.createElement("div")
    wrapper.style.position = "absolute"
    wrapper.style.top = "-10000px"
    wrapper.append(cloneBlockElement(blockElement))
    document.body.append(wrapper)

    event.dataTransfer.clearData()
    event.dataTransfer.setDragImage(wrapper, 0, 0)

    const cleanup = () => {
      wrapper.remove()
      document.removeEventListener("drop", cleanup)
      document.removeEventListener("dragend", cleanup)
    }

    document.addEventListener("drop", cleanup)
    document.addEventListener("dragend", cleanup)
  }

  view.dragging = {
    slice,
    move: true,
    node: selection,
  } as typeof view.dragging

  view.dispatch(view.state.tr.setSelection(selection))
}

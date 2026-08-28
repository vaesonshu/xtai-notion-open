import type { Editor } from "@tiptap/core"
import type { Node } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { EditorState } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

/** 侧栏菜单状态：可见性、定位参考矩形与当前块信息 */
export type BlockSideMenuState = {
  show: boolean
  referencePos: DOMRect | null
  blockId: string | null
  blockPos: number
  blockNode: Node | null
}

export const BLOCK_SIDE_MENU_PLUGIN_KEY = new PluginKey("blockSideMenu")

const HIDDEN_STATE: BlockSideMenuState = {
  show: false,
  referencePos: null,
  blockId: null,
  blockPos: -1,
  blockNode: null,
}

type BlockSideMenuListener = (state: BlockSideMenuState) => void

/** 从 DOM 节点向上查找所属的 blockContainer */
export function getDraggableBlockFromElement(
  element: Element,
  view: EditorView
): { node: HTMLElement; id: string } | undefined {
  let current: Element | null = element

  while (
    current?.parentElement &&
    current.parentElement !== view.dom &&
    current.getAttribute?.("data-node-type") !== "blockContainer"
  ) {
    current = current.parentElement
  }

  if (current?.getAttribute?.("data-node-type") !== "blockContainer") {
    return undefined
  }

  const id = current.getAttribute("data-id")

  if (!id) {
    return undefined
  }

  return { node: current as HTMLElement, id }
}

/** 用编辑器水平中线 + 鼠标 Y 命中块，避免 gutter 区域检测抖动 */
function getBlockFromMousePos(
  mousePos: { x: number; y: number },
  view: EditorView
): { node: HTMLElement; id: string } | undefined {
  const blockGroup = view.dom.firstChild

  if (!(blockGroup instanceof HTMLElement)) {
    return undefined
  }

  const editorBoundingBox = blockGroup.getBoundingClientRect()
  const elements = view.root.elementsFromPoint(
    editorBoundingBox.left + editorBoundingBox.width / 2,
    mousePos.y
  )

  for (const element of elements) {
    if (!view.dom.contains(element)) {
      continue
    }

    const block = getDraggableBlockFromElement(element, view)

    if (block) {
      return block
    }
  }

  return undefined
}

function resolveBlockContainerAtElement(
  blockEl: HTMLElement,
  view: EditorView
): { node: Node; pos: number } | undefined {
  try {
    const pos = view.posAtDOM(blockEl, 0)
    const $pos = view.state.doc.resolve(pos)
    const nodeAfter = $pos.nodeAfter

    if (nodeAfter?.type.name === "blockContainer") {
      return { node: nodeAfter, pos }
    }

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === "blockContainer") {
        return { node: $pos.node(depth), pos: $pos.before(depth) }
      }
    }
  } catch {
    return undefined
  }

  return undefined
}

class BlockSideMenuView {
  private state: BlockSideMenuState = HIDDEN_STATE
  private mousePos: { x: number; y: number } | undefined
  private hoveredBlock: HTMLElement | undefined
  private menuFrozen = false

  constructor(
    private readonly editor: Editor,
    private readonly pmView: EditorView,
    private readonly notify: BlockSideMenuListener
  ) {
    this.pmView.root.addEventListener(
      "mousemove",
      this.onMouseMove as EventListener,
      true
    )
    this.pmView.root.addEventListener(
      "keydown",
      this.onKeyDown as EventListener,
      true
    )
  }

  freezeMenu = () => {
    this.menuFrozen = true
  }

  unfreezeMenu = () => {
    this.menuFrozen = false
    this.hide()
  }

  private hide() {
    if (!this.state.show) {
      return
    }

    this.state = HIDDEN_STATE
    this.notify(this.state)
  }

  private publish(next: BlockSideMenuState) {
    this.state = next
    this.notify(next)
  }

  private updateStateFromMousePos() {
    if (this.menuFrozen || !this.mousePos || !this.editor.isEditable) {
      return
    }

    const block = getBlockFromMousePos(this.mousePos, this.pmView)

    if (!block) {
      this.hide()
      return
    }

    // 同一块上不重复更新，避免块间微动时把手闪烁
    if (
      this.state.show &&
      this.hoveredBlock?.getAttribute("data-id") === block.id
    ) {
      return
    }

    this.hoveredBlock = block.node

    const blockContent = block.node.firstElementChild

    if (!(blockContent instanceof HTMLElement)) {
      return
    }

    const blockGroup = this.pmView.dom.firstChild

    if (!(blockGroup instanceof HTMLElement)) {
      return
    }

    const context = resolveBlockContainerAtElement(block.node, this.pmView)

    if (!context) {
      return
    }

    const editorBoundingBox = blockGroup.getBoundingClientRect()
    const blockContentBoundingBox = blockContent.getBoundingClientRect()

    this.publish({
      show: true,
      referencePos: new DOMRect(
        editorBoundingBox.x,
        blockContentBoundingBox.y,
        blockContentBoundingBox.width,
        blockContentBoundingBox.height
      ),
      blockId: block.id,
      blockPos: context.pos,
      blockNode: context.node,
    })
  }

  onKeyDown = () => {
    if (this.state.show && this.editor.isFocused) {
      this.hide()
    }
  }

  onMouseMove = (event: MouseEvent) => {
    if (this.menuFrozen) {
      return
    }

    this.mousePos = { x: event.clientX, y: event.clientY }

    const editorRect = this.pmView.dom.getBoundingClientRect()
    const cursorWithinEditor =
      this.mousePos.x > editorRect.left &&
      this.mousePos.x < editorRect.right &&
      this.mousePos.y > editorRect.top &&
      this.mousePos.y < editorRect.bottom

    if (!cursorWithinEditor) {
      this.hide()
      return
    }

    this.updateStateFromMousePos()
  }

  update(_view: EditorView, prevState: EditorState) {
    const docChanged = !prevState.doc.eq(this.pmView.state.doc)

    if (docChanged && this.state.show) {
      this.updateStateFromMousePos()
    }
  }

  destroy() {
    this.hide()
    this.pmView.root.removeEventListener(
      "mousemove",
      this.onMouseMove as EventListener,
      true
    )
    this.pmView.root.removeEventListener(
      "keydown",
      this.onKeyDown as EventListener,
      true
    )
  }
}

/** 创建侧栏菜单控制器：ProseMirror Plugin + 订阅 API */
export function createBlockSideMenuController(editor: Editor) {
  const listeners = new Set<BlockSideMenuListener>()
  let currentState = HIDDEN_STATE
  let viewRef: BlockSideMenuView | undefined

  function emit(state: BlockSideMenuState) {
    currentState = state

    for (const listener of listeners) {
      listener(state)
    }
  }

  const plugin = new Plugin({
    key: BLOCK_SIDE_MENU_PLUGIN_KEY,
    view: (view) => {
      viewRef = new BlockSideMenuView(editor, view, emit)
      return viewRef
    },
  })

  return {
    plugin,
    subscribe(listener: BlockSideMenuListener) {
      listeners.add(listener)
      listener(currentState)

      return () => {
        listeners.delete(listener)
      }
    },
    freezeMenu() {
      viewRef?.freezeMenu()
    },
    unfreezeMenu() {
      viewRef?.unfreezeMenu()
    },
  }
}

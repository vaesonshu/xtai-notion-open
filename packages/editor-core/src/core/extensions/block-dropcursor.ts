import { Extension } from "@tiptap/core"
import type { EditorView } from "@tiptap/pm/view"
import { Plugin } from "@tiptap/pm/state"
import { dropPoint } from "@tiptap/pm/transform"

export type BlockDropcursorOptions = {
  color?: string | false
  width?: number
  class?: string
}

type PosAtCoords = NonNullable<ReturnType<EditorView["posAtCoords"]>>

/** 从操作系统拖入本地文件（非编辑器内块拖拽 reorder） */
export function isExternalFileDrag(
  event: Pick<DragEvent, "dataTransfer">,
  view: Pick<EditorView, "dragging">
): boolean {
  if (view.dragging?.slice) {
    return false
  }

  const types = event.dataTransfer?.types
  if (!types) {
    return false
  }

  return Array.from(types).includes("Files")
}

/** 鼠标下方是否为图片上传区 DOM（posAtCoords 在 NodeView 上经常不准） */
function isOverImageUploadSurface(event: DragEvent): boolean {
  const target = event.target
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(target.closest(".editor-image-upload-node"))
}

/** 沿祖先链检查 disableDropCursor（ProseMirror 默认只查 pos.inside 单节点） */
export function isDropCursorDisabled(
  view: EditorView,
  pos: PosAtCoords,
  event: DragEvent
): boolean {
  const $pos = view.state.doc.resolve(pos.pos)

  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const node = $pos.node(depth)
    const disableDropCursor = node.type.spec.disableDropCursor
    const disabled =
      typeof disableDropCursor === "function"
        ? disableDropCursor(view, pos, event)
        : disableDropCursor

    if (disabled) {
      return true
    }
  }

  return false
}

/** 块编辑器专用 Dropcursor：尊重 NodeSpec.disableDropCursor 并沿祖先链生效 */
class BlockDropCursorView {
  cursorPos: number | null = null
  element: HTMLElement | null = null
  timeout = -1
  lastDragEvent: DragEvent | null = null
  handlers: Array<{ name: string; handler: (event: Event) => void }> = []

  constructor(
    private editorView: EditorView,
    private options: BlockDropcursorOptions
  ) {
    this.handlers = ["dragover", "dragend", "drop", "dragleave"].map(
      (name) => {
        const handler = (event: Event) => {
          // 仅绑定 drag 事件方法，避免 keyof 误选到 cursorPos 等非函数属性
          switch (name) {
            case "dragover":
              this.dragover(event as DragEvent)
              break
            case "dragend":
              this.dragend()
              break
            case "drop":
              this.drop()
              break
            case "dragleave":
              this.dragleave(event as DragEvent)
              break
          }
        }
        editorView.dom.addEventListener(name, handler)
        return { name, handler }
      }
    )
  }

  destroy() {
    for (const { name, handler } of this.handlers) {
      this.editorView.dom.removeEventListener(name, handler)
    }
  }

  update(editorView: EditorView, prevState: { doc: EditorView["state"]["doc"] }) {
    if (this.cursorPos != null && prevState.doc !== editorView.state.doc) {
      if (this.lastDragEvent) {
        const target = this.computeTarget(this.lastDragEvent)
        if (target === this.cursorPos) {
          this.updateOverlay()
        } else {
          this.setCursor(target)
        }
      } else {
        this.updateOverlay()
      }
    }
  }

  setCursor(pos: number | null) {
    if (pos === this.cursorPos) {
      return
    }

    this.cursorPos = pos

    if (pos == null) {
      this.element?.parentNode?.removeChild(this.element)
      this.element = null
      return
    }

    this.updateOverlay()
  }

  updateOverlay() {
    if (this.cursorPos == null) {
      return
    }

    const $pos = this.editorView.state.doc.resolve(this.cursorPos)
    const isBlock = !$pos.parent.inlineContent
    let rect: DOMRect | undefined
    const editorDOM = this.editorView.dom
    const editorRect = editorDOM.getBoundingClientRect()
    const scaleX = editorRect.width / editorDOM.offsetWidth
    const scaleY = editorRect.height / editorDOM.offsetHeight

    if (isBlock) {
      const before = $pos.nodeBefore
      const after = $pos.nodeAfter

      if (before || after) {
        const node = this.editorView.nodeDOM(
          this.cursorPos - (before ? before.nodeSize : 0)
        )

        if (node instanceof HTMLElement) {
          const nodeRect = node.getBoundingClientRect()
          let top = before ? nodeRect.bottom : nodeRect.top

          if (before && after) {
            const afterNode = this.editorView.nodeDOM(this.cursorPos)
            if (afterNode instanceof HTMLElement) {
              top = (top + afterNode.getBoundingClientRect().top) / 2
            }
          }

          const halfWidth = ((this.options.width ?? 1) / 2) * scaleY
          rect = {
            left: nodeRect.left,
            right: nodeRect.right,
            top: top - halfWidth,
            bottom: top + halfWidth,
          } as DOMRect
        }
      }
    }

    if (!rect) {
      const coords = this.editorView.coordsAtPos(this.cursorPos)
      const halfWidth = ((this.options.width ?? 1) / 2) * scaleX
      rect = {
        left: coords.left - halfWidth,
        right: coords.left + halfWidth,
        top: coords.top,
        bottom: coords.bottom,
      } as DOMRect
    }

    const parent = this.editorView.dom.offsetParent
    if (!this.element) {
      this.element = (parent ?? document.body).appendChild(
        document.createElement("div")
      )
      if (this.options.class) {
        this.element.className = this.options.class
      }
      this.element.style.cssText =
        "position: absolute; z-index: 50; pointer-events: none;"
      if (this.options.color !== false) {
        this.element.style.backgroundColor =
          this.options.color ?? "currentColor"
      }
    }

    this.element.classList.toggle("prosemirror-dropcursor-block", isBlock)
    this.element.classList.toggle("prosemirror-dropcursor-inline", !isBlock)

    let parentLeft: number
    let parentTop: number

    if (
      !parent ||
      (parent === document.body &&
        getComputedStyle(parent).position === "static")
    ) {
      parentLeft = -window.scrollX
      parentTop = -window.scrollY
    } else if (parent instanceof HTMLElement) {
      const parentRect = parent.getBoundingClientRect()
      const parentScaleX = parentRect.width / parent.offsetWidth
      const parentScaleY = parentRect.height / parent.offsetHeight
      parentLeft = parentRect.left - parent.scrollLeft * parentScaleX
      parentTop = parentRect.top - parent.scrollTop * parentScaleY
    } else {
      parentLeft = 0
      parentTop = 0
    }

    this.element.style.left = `${(rect.left - parentLeft) / scaleX}px`
    this.element.style.top = `${(rect.top - parentTop) / scaleY}px`
    this.element.style.width = `${(rect.right - rect.left) / scaleX}px`
    this.element.style.height = `${(rect.bottom - rect.top) / scaleY}px`
  }

  scheduleRemoval(timeout: number) {
    clearTimeout(this.timeout)
    this.timeout = window.setTimeout(() => this.setCursor(null), timeout)
  }

  computeTarget(event: DragEvent): number | null {
    // 本地文件拖入编辑器不需要块间插入线（图片走上传区 / 业务 drop 逻辑）
    if (isExternalFileDrag(event, this.editorView)) {
      return null
    }

    if (isOverImageUploadSurface(event)) {
      return null
    }

    const pos = this.editorView.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })

    if (!pos || isDropCursorDisabled(this.editorView, pos, event)) {
      return null
    }

    let target = pos.pos

    if (this.editorView.dragging?.slice) {
      const point = dropPoint(
        this.editorView.state.doc,
        target,
        this.editorView.dragging.slice
      )
      if (point != null) {
        target = point
      }
    }

    return target
  }

  dragover(event: DragEvent) {
    if (!this.editorView.editable) {
      return
    }

    this.lastDragEvent = event
    const target = this.computeTarget(event)

    if (target != null) {
      this.setCursor(target)
      this.scheduleRemoval(5000)
    } else {
      // 目标无效时必须清掉旧线，否则从普通块移到上传区时横线会残留
      this.setCursor(null)
    }
  }

  dragend() {
    this.scheduleRemoval(20)
  }

  drop() {
    this.scheduleRemoval(20)
  }

  dragleave(event: DragEvent) {
    if (!this.editorView.dom.contains(event.relatedTarget as Node | null)) {
      this.setCursor(null)
    }
  }
}

function blockDropCursorPlugin(options: BlockDropcursorOptions = {}) {
  return new Plugin({
    view(editorView) {
      return new BlockDropCursorView(editorView, options)
    },
  })
}

export const BlockDropcursor = Extension.create<BlockDropcursorOptions>({
  name: "dropCursor",

  addOptions() {
    return {
      color: "currentColor",
      width: 1,
      class: undefined,
    }
  },

  addProseMirrorPlugins() {
    return [blockDropCursorPlugin(this.options)]
  },
})

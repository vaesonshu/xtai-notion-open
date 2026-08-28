import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import { Plugin } from "@tiptap/pm/state"

/** 与 style.css 中 padding-left + ::before 宽度对齐的复选框点击热区 */
export const CHECKLIST_CHECKBOX_HIT_WIDTH_PX = 28

type CheckListItemRef = {
  pos: number
  node: PMNode
}

/** 从文档位置向上找到 checkListItem 节点 */
export function findCheckListItemAtPos(
  state: EditorState,
  pos: number
): CheckListItemRef | null {
  const $pos = state.doc.resolve(pos)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)

    if (node.type.name === "checkListItem") {
      return { pos: $pos.before(depth), node }
    }
  }

  return null
}

/** 切换指定待办块的 checked 状态，供插件与单测复用 */
export function toggleCheckListItemChecked(
  state: EditorState,
  item: CheckListItemRef
): Transaction {
  return state.tr.setNodeMarkup(item.pos, undefined, {
    ...item.node.attrs,
    checked: !item.node.attrs.checked,
  })
}

/** 判断点击是否落在待办项左侧复选框区域 */
export function isCheckListCheckboxClick(
  li: HTMLElement,
  clientX: number
): boolean {
  const rect = li.getBoundingClientRect()
  return clientX - rect.left <= CHECKLIST_CHECKBOX_HIT_WIDTH_PX
}

/**
 * 待办块复选框点击：CSS ::before 无法绑定事件，因此在插件层拦截 li 左侧热区点击。
 */
export const CheckListItemClick = Extension.create({
  name: "checkListItemClick",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleClick(view, pos, event) {
            if (!view.editable) {
              return false
            }

            const target = event.target

            if (!(target instanceof HTMLElement)) {
              return false
            }

            const li = target.closest('li[data-type="checkListItem"]')

            if (!(li instanceof HTMLElement) || !view.dom.contains(li)) {
              return false
            }

            if (!isCheckListCheckboxClick(li, event.clientX)) {
              return false
            }

            const item =
              findCheckListItemAtPos(view.state, pos) ??
              findCheckListItemAtPos(view.state, view.posAtDOM(li, 0) + 1)

            if (!item) {
              return false
            }

            view.dispatch(toggleCheckListItemChecked(view.state, item))
            event.preventDefault()
            return true
          },
        },
      }),
    ]
  },
})

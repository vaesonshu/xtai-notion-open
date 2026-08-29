import { NodeSelection } from "@tiptap/pm/state"
import type { BlockEditor } from "@xtai-notion/editor-core"
import { generateBlockId } from "@xtai-notion/editor-core/block-schema/ids"

/** 计算 blockContainer 内 textblock 的可编辑光标位置 */
function getInlineCursorPos(
  containerPos: number,
  contentNode: { nodeSize: number },
  atEnd: boolean
) {
  const contentStart = containerPos + 1

  return atEnd ? contentStart + contentNode.nodeSize - 1 : containerPos + 2
}

/** 将文本光标定位到 blockContainer 的内容区 */
function setTextCursorInBlock(blockEditor: BlockEditor, blockId: string) {
  const { doc } = blockEditor.tiptap.state
  let cursorPos: number | null = null

  doc.descendants((node, pos) => {
    if (cursorPos !== null) {
      return false
    }

    if (node.type.name === "blockContainer" && node.attrs.id === blockId) {
      const content = node.firstChild

      if (content?.isTextblock) {
        cursorPos = getInlineCursorPos(pos, content, false)
      }

      return false
    }

    return undefined
  })

  if (cursorPos !== null) {
    blockEditor.tiptap
      .chain()
      .focus()
      .setTextSelection(Math.max(1, cursorPos))
      .run()
  }
}

/** 侧栏拖拽钮点击：整块选中，供下拉菜单操作 */
export function selectBlockContainer(
  blockEditor: BlockEditor,
  blockPos: number
) {
  const { view } = blockEditor.tiptap
  const node = view.state.doc.nodeAt(blockPos)
  if (!node || node.type.name !== "blockContainer") {
    return
  }

  view.focus()
  view.dispatch(
    view.state.tr.setSelection(NodeSelection.create(view.state.doc, blockPos))
  )
}

/** 删除侧栏当前块；文档不能为空，删光后由 BlockEditor 补空段落 */
export function deleteSelectedBlock(blockEditor: BlockEditor, blockId: string) {
  blockEditor.removeBlocks([blockId])
}

/** 侧栏 +：始终在当前块下方插入空段落并聚焦 */
export function insertParagraphBelowBlock(
  blockEditor: BlockEditor,
  blockId: string
) {
  const newId = generateBlockId()
  blockEditor.insertBlocks([{ type: "paragraph", id: newId }], blockId, "after")
  setTextCursorInBlock(blockEditor, newId)
}

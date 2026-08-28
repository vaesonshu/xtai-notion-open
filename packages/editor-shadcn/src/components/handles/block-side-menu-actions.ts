import type { BlockEditor } from "@xtai-notion/editor-core"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import { generateBlockId } from "@xtai-notion/editor-core/block-schema/ids"

function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block
    }

    const nested = findBlockById(block.children, id)

    if (nested) {
      return nested
    }
  }

  return null
}

function blockHasVisibleContent(block: Block | null): boolean {
  if (!block?.content) {
    return false
  }

  if (Array.isArray(block.content)) {
    return block.content.some((item) =>
      item.type === "text" ? item.text.length > 0 : true
    )
  }

  return true
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

      if (content) {
        cursorPos = pos + 1 + Math.max(0, content.content.size)
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

/** 在当前块后插入段落并打开斜杠命令菜单 */
export function insertBlockAndOpenSlashMenu(
  blockEditor: BlockEditor,
  blockId: string
) {
  const block = findBlockById(blockEditor.document, blockId)
  const isEmpty = !blockHasVisibleContent(block)

  if (isEmpty) {
    setTextCursorInBlock(blockEditor, blockId)
  } else {
    const newId = generateBlockId()
    blockEditor.insertBlocks([{ type: "paragraph", id: newId }], blockId, "after")
    setTextCursorInBlock(blockEditor, newId)
  }

  blockEditor.tiptap.chain().focus().insertContent("/").run()
}

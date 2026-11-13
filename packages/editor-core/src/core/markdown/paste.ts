import type { BlockEditor } from "../block-editor"
import { handleMarkdownPaste as handleMarkdownPasteOnEditor } from "../api/clipboard/fromClipboard/handleMarkdownPaste"

/**
 * 纯 Markdown 粘贴转成块。返回 true 表示已消费 paste。
 * @deprecated 新代码请使用 `handleMarkdownPaste(editor.tiptap, event)` 或从 `core/api` 导入。
 */
export function handleMarkdownPaste(
  editor: BlockEditor,
  event: ClipboardEvent
): boolean {
  return handleMarkdownPasteOnEditor(editor.tiptap, event)
}

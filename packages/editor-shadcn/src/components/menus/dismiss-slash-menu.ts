import { exitSuggestion } from "@tiptap/suggestion"
import type { Editor } from "@tiptap/core"
import { slashMenuPluginKey } from "./slash-menu-plugin-key"

/** 关闭 slash 建议层，避免链接弹层抢焦点时误触发 `/` 菜单 */
export function dismissSlashMenu(editor: Editor) {
  exitSuggestion(editor.view, slashMenuPluginKey)
}

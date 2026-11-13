import { Extension } from "@tiptap/core"
import {
  handleBackspace,
  handleEnter,
} from "../api/blockManipulation/keymap-handlers"

export {
  handleBackspace,
  handleEnter,
} from "../api/blockManipulation/keymap-handlers"

/**
 * 块文档键盘映射：Enter 拆块/新建块，Backspace 合并或删除空块。
 * Enter 放在插件层，排在斜杠/提及 Suggestion 之后，避免菜单打开时抢 Enter。
 */
export const BlockKeymap = Extension.create({
  name: "blockKeymap",
  addKeyboardShortcuts() {
    return {
      Enter: () => handleEnter(this.editor.state, this.editor.view.dispatch),
    }
  },
})

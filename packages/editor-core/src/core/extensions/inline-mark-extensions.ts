import Link from "@tiptap/extension-link"
import Strike from "@tiptap/extension-strike"

/** 链接右边界不含 mark，避免在链接文字后继续输入仍带链接样式 */
export const EditorLink = Link.extend({
  inclusive: false,
})

/** 删除线右边界不含 mark，避免继续输入仍带删除线样式 */
export const EditorStrike = Strike.extend({
  inclusive: false,
})

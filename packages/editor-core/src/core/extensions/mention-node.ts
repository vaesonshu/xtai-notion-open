import { Mention } from "@tiptap/extension-mention"
import { mergeAttributes } from "@tiptap/core"

/**
 * 文档提及节点：基于 @tiptap/extension-mention 的原子节点（atom），光标不可
 * 进入其中，从根本上避免“选中提及后继续输入会延续链接下划线”的问题。
 */
export const MentionNode = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
        renderHTML: (attributes) =>
          attributes.href ? { href: attributes.href } : {},
      },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label ?? node.attrs.id ?? ""
    return [
      "a",
      mergeAttributes(
        { "data-type": this.name, "data-mention": "true" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `@${label}`,
    ]
  },
  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id ?? ""}`
  },
})

import type { Editor, Range } from "@tiptap/core"
import type { MentionableItem } from "../../mention"

/**
 * 将选定文档作为原子 mention 节点插入编辑器。
 */
export function insertMention(
  editor: Editor,
  range: Range,
  item: MentionableItem
): void {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContentAt(range.from, {
      type: "mention",
      attrs: {
        id: item.id,
        label: item.title,
        href: item.href,
      },
    })
    .run()
}

import type { Editor, Range } from "@tiptap/core"

/** 可被 @ 提及的目标文档，由宿主应用通过 MentionProvider 提供。 */
export type MentionableItem = {
  id: string
  /** 展示在编辑器中的标题，也是插入链接的文本。 */
  title: string
  /** 点击提及后跳转的地址，例如 `/documents/<id>`。 */
  href: string
  /** 额外关键词，用于命中匹配（可选）。 */
  keywords?: string[]
}

/**
 * 提及候选的来源。宿主应用注入此接口，editor-core 不感知具体数据源。
 * 支持同步或异步返回，便于从远端接口拉取文档列表。
 */
export type MentionProvider = (
  query: string
) => MentionableItem[] | Promise<MentionableItem[]>

/** 在候选列表为空时提示用户；宿主可覆盖文案。 */
export type MentionOptions = {
  emptyText?: string
}

export function filterMentionItems(
  items: MentionableItem[],
  query: string
): MentionableItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  if (!normalizedQuery) {
    return items
  }

  return items.filter((item) =>
    [item.title, item.id, ...(item.keywords ?? [])].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery)
    )
  )
}

/**
 * 将选定文档作为原子 mention 节点插入编辑器：先删除触发 @ 的范围，再在
 * range.from 处插入 `mention` 节点（含 id/label/href），使其呈现为不可拆分
 * 的 `@标题`，点击可跳转到对应文档。节点由 @tiptap/extension-mention 渲染。
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

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

export { insertMention } from "../api/commands/insertMention"

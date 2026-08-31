export type PublicationStatus = "draft" | "pending" | "published"

export type Article = {
  id: string
  title: string
  category: string
  author: string
  status: "已发布" | "草稿" | "待审核"
  publishedAt: string
}

export const STATUS_LABEL: Record<PublicationStatus, Article["status"]> = {
  published: "已发布",
  draft: "草稿",
  pending: "待审核",
}

export const STATUS_API_VALUE: Record<string, PublicationStatus | undefined> = {
  全部状态: undefined,
  全部: undefined,
  已发布: "published",
  草稿: "draft",
  待审核: "pending",
}

export function formatAdminDateTime(value: string | Date | null): string {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export type ArticleFiltersValue = {
  query: string
  category: string
  status: string
}

export function filterArticles(
  source: readonly Article[],
  filters: ArticleFiltersValue
) {
  const query = filters.query.trim().toLowerCase()
  return source.filter(
    (article) =>
      (!query ||
        `${article.title} ${article.author} ${article.id}`
          .toLowerCase()
          .includes(query)) &&
      (filters.category === "全部分类" ||
        filters.category === "全部" ||
        article.category === filters.category) &&
      (filters.status === "全部状态" ||
        filters.status === "全部" ||
        article.status === filters.status)
  )
}

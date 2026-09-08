import Link from "next/link"

export type PublishedArticle = {
  id: string
  title: string
  author: string | null
  publishedAt: string
  category: string
  excerpt?: string
}

export function PublishedArticleList({
  articles,
}: {
  articles: readonly PublishedArticle[]
}) {
  if (!articles.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        暂无已发布文章
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <Link
          key={article.id}
          href={`/square/${article.id}`}
          className="border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <article>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5">
                {article.category}
              </span>
              <time dateTime={article.publishedAt}>
                {new Intl.DateTimeFormat("zh-CN", {
                  dateStyle: "medium",
                }).format(new Date(article.publishedAt))}
              </time>
            </div>
            <h2 className="mt-3 text-base font-semibold text-foreground">
              {article.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {article.author ?? "匿名作者"}
            </p>
            {article.excerpt ? (
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {article.excerpt}
              </p>
            ) : null}
          </article>
        </Link>
      ))}
    </div>
  )
}

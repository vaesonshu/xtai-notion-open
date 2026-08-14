export type PublishedArticle = {
  id: string
  title: string
  publishedAt: string
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
        <article key={article.id} className="border border-border bg-card p-5">
          {/* The list stays public without linking into the member-only editor route. */}
          <h2 className="text-base font-semibold text-foreground">
            {article.title}
          </h2>
          <time className="mt-3 block text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
              new Date(article.publishedAt)
            )}
          </time>
        </article>
      ))}
    </div>
  )
}

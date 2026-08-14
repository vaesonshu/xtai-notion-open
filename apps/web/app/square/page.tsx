import {
  PublishedArticleList,
  type PublishedArticle,
} from "../../components/square/published-article-list"

async function getPublishedArticles(): Promise<PublishedArticle[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return []

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/square/articles`, {
    // Public content must not be cached as an authenticated user response.
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Unable to load published articles")
  return response.json() as Promise<PublishedArticle[]>
}

export default async function SquarePage() {
  const articles = await getPublishedArticles()

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <section className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">广场</h1>
        <p className="mt-2 text-sm text-muted-foreground">已发布的知识文章</p>
        <div className="mt-8">
          <PublishedArticleList articles={articles} />
        </div>
      </section>
    </main>
  )
}

import {
  PublishedArticleList,
  type PublishedArticle,
} from "../../components/square/published-article-list"
import { apiRequestJson, getClientApiBase } from "@/lib/api-client"

async function getPublishedArticles(): Promise<PublishedArticle[]> {
  if (!getClientApiBase()) return []

  return apiRequestJson<PublishedArticle[]>({
    path: "/square/articles",
    // Public content must not be cached as an authenticated user response.
    cache: "no-store",
  })
}

export default async function SquarePage() {
  const articles = await getPublishedArticles()

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <section className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">写作广场</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          浏览已发布的知识文章
        </p>
        <div className="mt-8">
          <PublishedArticleList articles={articles} />
        </div>
      </section>
    </main>
  )
}

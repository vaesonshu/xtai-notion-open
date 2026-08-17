import { notFound } from "next/navigation"
import {
  ArticleReader,
  type ArticleReaderArticle,
} from "../../../components/square/article-reader"

async function getPublishedArticle(
  articleId: string
): Promise<ArticleReaderArticle | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return null

  const response = await fetch(
    `${apiUrl.replace(/\/$/, "")}/square/articles/${articleId}`,
    { cache: "no-store" }
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Unable to load published article")

  return response.json() as Promise<ArticleReaderArticle>
}

export default async function SquareArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>
}) {
  const { articleId } = await params
  const article = await getPublishedArticle(articleId)
  if (!article) notFound()

  return <ArticleReader article={article} />
}

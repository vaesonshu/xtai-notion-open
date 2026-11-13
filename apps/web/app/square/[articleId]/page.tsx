import { headers } from "next/headers"
import { notFound } from "next/navigation"
import {
  ArticleReader,
  type ArticleReaderArticle,
} from "../../../components/square/article-reader"
import { apiRequest, getClientApiBase } from "@/lib/api-client"

async function fetchPublishedArticle(
  articleId: string
): Promise<Response | null> {
  const path = `/square/articles/${encodeURIComponent(articleId)}`
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  if (host) {
    const proto = headerList.get("x-forwarded-proto") ?? "http"
    // 经同源 Route Handler 代理 API，避免 SSR 相对路径或 env 缺失导致 404。
    return fetch(`${proto}://${host}${path}`, { cache: "no-store" })
  }

  const apiBase = getClientApiBase()
  if (!apiBase) return null
  return apiRequest({ path, cache: "no-store" })
}

async function getPublishedArticle(
  articleId: string
): Promise<ArticleReaderArticle | null> {
  const response = await fetchPublishedArticle(articleId)
  if (!response) return null
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

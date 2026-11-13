import { buildApiUrl } from "@/lib/resolve-api-url"
import { NextResponse } from "next/server"

type RouteContext = { params: Promise<{ documentId: string }> }

/** 将公开文章详情代理到 API，避免 RSC 相对路径命中 Next 路由而 404。 */
export async function GET(request: Request, context: RouteContext) {
  const { documentId } = await context.params
  const target = buildApiUrl(
    request,
    `/square/articles/${encodeURIComponent(documentId)}`
  )
  if (!target) {
    return NextResponse.json(
      { message: "Square API is not configured" },
      { status: 503 }
    )
  }

  const response = await fetch(target, { cache: "no-store" })
  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  })
}

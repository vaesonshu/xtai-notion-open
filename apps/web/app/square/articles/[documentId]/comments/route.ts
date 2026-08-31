import { buildApiUrl } from "@/lib/resolve-api-url"
import { NextResponse } from "next/server"

type RouteContext = { params: Promise<{ documentId: string }> }

function forwardHeaders(request: Request): Headers {
  const headers = new Headers()
  for (const name of ["cookie", "x-dev-user-id", "content-type"]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

export async function GET(request: Request, context: RouteContext) {
  const { documentId } = await context.params
  const target = buildApiUrl(
    request,
    `/square/articles/${encodeURIComponent(documentId)}/comments`
  )
  if (!target) {
    return NextResponse.json(
      { message: "Comment service is not configured" },
      { status: 503 }
    )
  }

  const response = await fetch(target)
  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  })
}

export async function POST(request: Request, context: RouteContext) {
  const { documentId } = await context.params
  const target = buildApiUrl(
    request,
    `/square/articles/${encodeURIComponent(documentId)}/comments`
  )
  if (!target) {
    return NextResponse.json(
      { message: "Comment service is not configured" },
      { status: 503 }
    )
  }

  // 同源代理评论写入，确保 HttpOnly session cookie 能随请求转发到 API。
  const response = await fetch(
    target,
    {
      method: "POST",
      headers: forwardHeaders(request),
      body: await request.text(),
    }
  )
  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  })
}

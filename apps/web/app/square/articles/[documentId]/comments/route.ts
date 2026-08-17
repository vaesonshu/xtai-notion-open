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
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")
  const { documentId } = await context.params
  if (!apiUrl || !documentId) {
    return NextResponse.json(
      { message: "Comment service is not configured" },
      { status: 503 }
    )
  }

  const response = await fetch(
    `${apiUrl}/square/articles/${encodeURIComponent(documentId)}/comments`
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

export async function POST(request: Request, context: RouteContext) {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")
  const { documentId } = await context.params
  if (!apiUrl || !documentId) {
    return NextResponse.json(
      { message: "Comment service is not configured" },
      { status: 503 }
    )
  }

  // 同源代理评论写入，确保 HttpOnly session cookie 能随请求转发到 API。
  const response = await fetch(
    `${apiUrl}/square/articles/${encodeURIComponent(documentId)}/comments`,
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

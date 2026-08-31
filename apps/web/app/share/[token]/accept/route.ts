import { buildApiUrl } from "@/lib/resolve-api-url"
import { NextResponse } from "next/server"

type RouteContext = { params: Promise<{ token: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params
  const target = buildApiUrl(
    request,
    `/share/${encodeURIComponent(token)}/accept`
  )
  if (!target) {
    return NextResponse.json(
      { message: "Share service is not configured" },
      { status: 503 }
    )
  }

  // Forward only authentication headers; the API must never receive arbitrary
  // browser headers from this same-origin proxy.
  const headers = new Headers()
  for (const name of ["cookie", "x-dev-user-id"]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const response = await fetch(
    target,
    {
      method: "POST",
      headers,
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

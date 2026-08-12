import { NextResponse } from "next/server"

type RouteContext = { params: Promise<{ documentId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")
  const { documentId } = await context.params
  if (!apiUrl || !documentId) {
    return NextResponse.json(
      { message: "Share service is not configured" },
      { status: 503 }
    )
  }

  // Keep share creation same-origin so HttpOnly session cookies survive local
  // hostname differences between the web app and API.
  const headers = new Headers()
  for (const name of ["cookie", "x-dev-user-id"]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const response = await fetch(
    `${apiUrl}/documents/${encodeURIComponent(documentId)}/share-link`,
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

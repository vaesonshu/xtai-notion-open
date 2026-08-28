import { afterEach, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/share/[token]/accept/route"

describe("share acceptance proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.NEXT_PUBLIC_API_URL
  })

  it("forwards the session cookie and dev identity to the API", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:3100"
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ documentId: "doc-1" })))

    const request = new Request("http://localhost:3000/share/token/accept", {
      method: "POST",
      headers: {
        cookie: "session_token=session-1",
        "x-dev-user-id": "user-1",
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ token: "token" }),
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3100/share/token/accept",
      expect.objectContaining({ method: "POST" })
    )
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = options.headers as Headers
    expect(headers.get("cookie")).toBe("session_token=session-1")
    expect(headers.get("x-dev-user-id")).toBe("user-1")
  })
})

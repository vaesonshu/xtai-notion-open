import { afterEach, describe, expect, it, vi } from "vitest"
import {
  apiRequest,
  apiRequestJson,
  buildClientApiUrl,
  readApiErrorMessage,
} from "@/lib/api-client"

describe("buildClientApiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("keeps auth routes on the web origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
    expect(buildClientApiUrl("/auth/login")).toBe("/auth/login")
  })

  it("prefixes API routes with NEXT_PUBLIC_API_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
    expect(buildClientApiUrl("/documents")).toBe(
      "http://127.0.0.1:3100/documents"
    )
  })

  it("keeps same-origin route handlers on the web origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
    expect(
      buildClientApiUrl("/square/articles/demo/comments", { sameOrigin: true })
    ).toBe("/square/articles/demo/comments")
  })
})

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("sends JSON body, cookie credentials, and dev user header", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))

    await apiRequest({
      path: "/documents",
      method: "POST",
      userId: "user-1",
      json: { title: "Hello" },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3100/documents",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ title: "Hello" }),
      })
    )
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json"
    )
    expect(new Headers(init.headers).get("x-dev-user-id")).toBe("user-1")
  })

  it("uploads multipart form data without forcing JSON content-type", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    const formData = new FormData()
    formData.set("file", new Blob(["x"], { type: "image/png" }), "x.png")

    await apiRequest({
      path: "/documents/doc-1/images",
      method: "POST",
      userId: "user-1",
      body: formData,
    })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(init.headers).get("content-type")).toBeNull()
    expect(init.body).toBe(formData)
  })
})

describe("readApiErrorMessage", () => {
  it("prefers JSON message fields", async () => {
    const response = new Response(JSON.stringify({ message: "邮箱已存在" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    })

    await expect(readApiErrorMessage(response, "注册失败")).resolves.toBe(
      "邮箱已存在"
    )
  })
})

describe("apiRequestJson", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("throws parsed API errors", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "无权访问" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    )

    await expect(
      apiRequestJson({ path: "/admin/users", userId: "user-1" })
    ).rejects.toThrow("无权访问")
  })
})

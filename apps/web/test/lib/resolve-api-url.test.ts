import { describe, expect, it } from "vitest"

import { buildApiUrl, resolveApiBaseUrl } from "@/lib/resolve-api-url"

describe("resolveApiBaseUrl", () => {
  const request = new Request(
    "https://xtai-notion-open-web.vercel.app/share/token/accept",
    { method: "POST" }
  )

  it("keeps absolute API URLs unchanged", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:3100"
    expect(resolveApiBaseUrl(request)).toBe("http://127.0.0.1:3100")
  })

  it("resolves same-origin /api paths for server-side fetch", () => {
    process.env.NEXT_PUBLIC_API_URL = "/api"
    expect(resolveApiBaseUrl(request)).toBe(
      "https://xtai-notion-open-web.vercel.app/api"
    )
  })

  it("returns null when API URL is unset", () => {
    delete process.env.NEXT_PUBLIC_API_URL
    expect(resolveApiBaseUrl(request)).toBeNull()
  })
})

describe("buildApiUrl", () => {
  it("joins base and pathname", () => {
    process.env.NEXT_PUBLIC_API_URL = "/api"
    const request = new Request(
      "https://xtai-notion-open-web.vercel.app/share/token/accept",
      { method: "POST" }
    )
    expect(buildApiUrl(request, "/share/token/accept")).toBe(
      "https://xtai-notion-open-web.vercel.app/api/share/token/accept"
    )
  })
})

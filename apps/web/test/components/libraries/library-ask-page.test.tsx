import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LibraryAskPage } from "@/components/libraries/library-ask-page"
import type { LibrarySummary } from "@/lib/library-api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const viewerLibrary: LibrarySummary = {
  id: "lib-1",
  name: "产品资料库",
  role: "viewer",
  sourceCount: 1,
  memberCount: 1,
  updatedAt: "2026-01-02T00:00:00.000Z",
  embeddingConfigured: false,
}

describe("LibraryAskPage", () => {
  it("shows the contact-owner hint when embedding is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
        const method = options?.method ?? "GET"
        if (method === "GET" && String(_url).includes("/sources")) {
          return Promise.resolve({ ok: true, json: async () => [] })
        }
        if (method === "GET" && String(_url).includes("/libraries/lib-1")) {
          return Promise.resolve({
            ok: true,
            json: async () => viewerLibrary,
          })
        }
        if (method === "GET" && String(_url).endsWith("/libraries")) {
          return Promise.resolve({
            ok: true,
            json: async () => [viewerLibrary],
          })
        }
        return Promise.resolve({ ok: true, json: async () => [] })
      })
    )

    render(<LibraryAskPage userId="user-1" libraryId="lib-1" />)

    expect(
      await screen.findByText("请联系资料库所有者配置嵌入模型")
    ).toBeInTheDocument()
  })
})

import "@testing-library/jest-dom/vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import DocumentsIndexPage from "@/app/documents/page"

const replace = vi.fn()
const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "demo-owner", name: "林", color: "#E64B3C" },
    loading: false,
    refresh: vi.fn(),
  }),
}))

describe("DocumentsIndexPage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    replace.mockReset()
    push.mockReset()
    vi.unstubAllGlobals()
  })

  it("routes authenticated users to their first personal document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "shared", role: "editor" },
          { id: "personal", role: "owner" },
        ],
      })
    )

    render(<DocumentsIndexPage />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/documents/personal")
    })
  })

  it("shows a creation button when the user has no documents yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    )

    render(<DocumentsIndexPage />)

    expect(
      await screen.findByRole("button", { name: "新建文档" })
    ).toBeVisible()
  })
})

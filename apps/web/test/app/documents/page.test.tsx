import "@testing-library/jest-dom/vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import DocumentsIndexPage, {
  resetDocumentsEntryBootstrapForTests,
  resolveDocumentsEntryTarget,
} from "@/app/documents/page"

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
    resetDocumentsEntryBootstrapForTests()
    vi.unstubAllGlobals()
  })

  it("routes authenticated users to their first personal document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "shared", role: "editor" },
          { id: "personal", role: "owner" },
        ],
      })
    )

    render(<DocumentsIndexPage />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/documents/shared")
    })
  })

  it("creates a default document when the user has no documents yet", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "fresh-document" }),
      })
    vi.stubGlobal("fetch", fetchMock)

    render(<DocumentsIndexPage />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/documents/fresh-document")
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST" })
  })

  it("shows a creation button when bootstrap fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    )

    render(<DocumentsIndexPage />)

    expect(
      await screen.findByRole("button", { name: "新建文档" })
    ).toBeVisible()
  })
})

describe("resolveDocumentsEntryTarget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns the first document without creating a new one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "first", role: "owner" },
          { id: "second", role: "owner" },
        ],
      })
    )

    await expect(resolveDocumentsEntryTarget("demo-owner")).resolves.toBe(
      "first"
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

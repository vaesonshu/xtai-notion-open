import "@testing-library/jest-dom/vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ShareAcceptancePage from "@/app/share/[token]/page"

const replace = vi.fn()
let authState: {
  user: { id: string } | null
  loading: boolean
} = { user: { id: "member-1" }, loading: false }
let token = "share-token"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useParams: () => ({ token }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}))

describe("ShareAcceptancePage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    replace.mockReset()
    authState = { user: { id: "member-1" }, loading: false }
    token = "share-token"
  })

  it("accepts the link and opens the document", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ documentId: "doc-1", role: "editor" }), {
        status: 200,
      })
    )

    render(<ShareAcceptancePage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledWith(
      "/share/share-token/accept",
      expect.objectContaining({ method: "POST", credentials: "include" })
    )
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/documents/doc-1")
    )
  })

  it("sends unauthenticated visitors to login with the share path", async () => {
    authState = { user: null, loading: false }

    render(<ShareAcceptancePage />)

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?returnTo=%2Fshare%2Fshare-token"
      )
    )
  })

  it("redirects to login when the acceptance request expires", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 })
    )

    render(<ShareAcceptancePage />)

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?returnTo=%2Fshare%2Fshare-token"
      )
    )
  })

  it("shows an API error for an invalid token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Share link not found" }), {
        status: 404,
      })
    )

    render(<ShareAcceptancePage />)

    expect(await screen.findByText("Share link not found")).toBeVisible()
    expect(replace).not.toHaveBeenCalled()
  })
})

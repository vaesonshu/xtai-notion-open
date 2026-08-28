import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import {
  getDocumentIdAfterDeletion,
  resetDocumentsCacheForTests,
  WorkspaceShell,
} from "@/components/inkspace/workspace-shell"

const { push, replace } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}))

vi.mock("@/components/inkspace/document-workspace", () => ({
  DocumentWorkspace: ({ documentId }: { documentId: string }) => (
    <div data-testid="workspace-document-id">{documentId}</div>
  ),
}))

const props = {
  documentId: "demo-document",
  user: { id: "demo-owner", name: "林", color: "#E64B3C" },
  apiUrl: "http://127.0.0.1:3100",
  collaborationUrl: "ws://127.0.0.1:3101",
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  resetDocumentsCacheForTests()
})

describe("WorkspaceShell", () => {
  it("opens the first personal document on the app root", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "first", title: "First" },
          { id: "second", title: "Second" },
        ],
      })
    )

    render(<WorkspaceShell {...props} openFirstDocument />)

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/documents/first")
    })
  })

  it("selects the next personal document after deleting the first one", () => {
    expect(
      getDocumentIdAfterDeletion(
        [
          { id: "first", title: "First" },
          { id: "second", title: "Second" },
          { id: "third", title: "Third" },
        ],
        "first"
      )
    ).toBe("second")
  })

  it("selects the previous document when deleting the last one", () => {
    expect(
      getDocumentIdAfterDeletion(
        [
          { id: "first", title: "First" },
          { id: "second", title: "Second" },
        ],
        "second"
      )
    ).toBe("first")
  })

  it("returns home when deleting the only document", () => {
    expect(
      getDocumentIdAfterDeletion([{ id: "only", title: "Only" }], "only")
    ).toBeNull()
  })

  it("navigates to the created document URL", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve({
          ok: true,
          json: async () =>
            options?.method === "POST" ? { id: "new-document" } : [],
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    render(<WorkspaceShell {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /新建文档/ }))

    // The implementation includes credentials: 'include' so assert using
    // objectContaining to avoid brittle exact-object matching while still
    // verifying the important request parts (method and headers).
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:3100/documents",
        expect.objectContaining({
          method: "POST",
          headers: { "x-dev-user-id": "demo-owner" },
        })
      )
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/documents/new-document")
    })
  })

  it("reuses the cached document list when the shell remounts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "first", title: "First", role: "owner" }],
    })
    vi.stubGlobal("fetch", fetchMock)

    const { unmount } = render(<WorkspaceShell {...props} />)
    await waitFor(() => expect(screen.getByText("First")).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledOnce()

    unmount()
    render(<WorkspaceShell {...props} documentId="another-document" />)
    await waitFor(() => expect(screen.getByText("First")).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("shows a clear error when document creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )
    render(<WorkspaceShell {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /新建文档/ }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("无法连接到文档服务")
      )
    })
    expect(screen.getByRole("button", { name: /新建文档/ })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })
})

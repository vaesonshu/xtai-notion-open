import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "@/lib/toast"
import {
  getDocumentIdAfterDeletion,
  resetDocumentsCacheForTests,
  WorkspaceShell,
} from "@/components/inkspace/workspace-shell"
import { buildClientApiUrl } from "@/lib/api-client"

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

/** 侧边栏快捷「收藏」与文档星标按钮同名，取 DOM 中第一个快捷入口 */
function clickFavoritesShortcut() {
  fireEvent.click(screen.getAllByRole("button", { name: "收藏" })[0]!)
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  resetDocumentsCacheForTests()
})

describe("WorkspaceShell", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
  })
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
      const postCall = fetchMock.mock.calls.find(
        ([, options]) => (options as RequestInit | undefined)?.method === "POST"
      )
      expect(postCall?.[0]).toBe(buildClientApiUrl("/documents"))
      expect(
        new Headers((postCall?.[1] as RequestInit | undefined)?.headers).get(
          "x-dev-user-id"
        )
      ).toBe("demo-owner")
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/documents/new-document")
    })
  })

  it("shows cached documents immediately when the shell remounts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "first", title: "First", role: "owner" }],
    })
    vi.stubGlobal("fetch", fetchMock)

    const { unmount } = render(<WorkspaceShell {...props} />)
    await waitFor(() =>
      expect(screen.getAllByText("First").length).toBeGreaterThan(0)
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)

    unmount()
    render(<WorkspaceShell {...props} documentId="another-document" />)
    expect(screen.getAllByText("First").length).toBeGreaterThan(0)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
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

  it("shows favorites in the main panel while keeping personal documents in the sidebar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "favorite-doc",
            title: "Favorite doc",
            role: "owner",
            isFavorite: true,
          },
          { id: "personal-doc", title: "Personal doc", role: "owner" },
        ],
      })
    )

    render(<WorkspaceShell {...props} />)
    await waitFor(() =>
      expect(screen.getAllByText("Personal doc").length).toBeGreaterThan(0)
    )

    clickFavoritesShortcut()

    await waitFor(() => {
      expect(screen.getByTestId("favorites-panel")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("workspace-document-id")).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId("favorites-panel")).getByRole("button", {
        name: "Favorite doc",
      })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Personal doc").length).toBeGreaterThan(0)
  })

  it("keeps the favorites panel open when the favorites shortcut is clicked again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "favorite-doc",
            title: "Favorite doc",
            role: "owner",
            isFavorite: true,
          },
        ],
      })
    )

    render(<WorkspaceShell {...props} />)
    await waitFor(() =>
      expect(screen.getAllByText("Favorite doc").length).toBeGreaterThan(0)
    )

    clickFavoritesShortcut()
    await waitFor(() => {
      expect(screen.getByTestId("favorites-panel")).toBeInTheDocument()
    })

    clickFavoritesShortcut()
    expect(screen.getByTestId("favorites-panel")).toBeInTheDocument()
    expect(screen.queryByTestId("workspace-document-id")).not.toBeInTheDocument()
  })

  it("shows trash in the main panel while keeping personal documents in the sidebar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes("/documents/trash")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "trashed", title: "Deleted doc", role: "owner" },
            ],
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "personal-doc", title: "Personal doc", role: "owner" },
          ],
        })
      })
    )

    render(<WorkspaceShell {...props} />)
    await waitFor(() =>
      expect(screen.getAllByText("Personal doc").length).toBeGreaterThan(0)
    )

    fireEvent.click(screen.getByRole("button", { name: "回收站" }))
    await waitFor(() => {
      expect(screen.getByTestId("trash-panel")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("workspace-document-id")).not.toBeInTheDocument()
    expect(screen.getAllByText("Personal doc").length).toBeGreaterThan(0)
  })

  it("keeps the trash panel open when the trash shortcut is clicked again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes("/documents/trash")) {
          return Promise.resolve({ ok: true, json: async () => [] })
        }
        return Promise.resolve({ ok: true, json: async () => [] })
      })
    )

    render(<WorkspaceShell {...props} />)
    await waitFor(() => expect(screen.getByRole("button", { name: "回收站" })))

    fireEvent.click(screen.getByRole("button", { name: "回收站" }))
    await waitFor(() => {
      expect(screen.getByTestId("trash-panel")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "回收站" }))
    expect(screen.getByTestId("trash-panel")).toBeInTheDocument()
  })
})

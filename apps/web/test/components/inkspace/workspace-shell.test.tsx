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

const defaultWorkspace = {
  id: "ws-1",
  name: "我的知识库",
  memberCount: 1,
  documentCount: 0,
  role: "owner",
  aiSettings: { aiProvider: "cloud" as const },
}

function createShellFetchMock(
  handler?: (
    url: string,
    options?: RequestInit
  ) => { ok: boolean; json: () => Promise<unknown> } | null
) {
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const custom = handler?.(url, options)
    if (custom) return Promise.resolve(custom)

    const method = options?.method ?? "GET"
    if (url.includes("/workspaces/ws-1/documents") && method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: "new-document", workspaceId: "ws-1" }),
      })
    }
    if (url.includes("/workspaces/ws-1/documents")) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    }
    if (url.endsWith("/workspaces")) {
      return Promise.resolve({
        ok: true,
        json: async () => [defaultWorkspace],
      })
    }
    if (url.includes("/documents/trash")) {
      return Promise.resolve({ ok: true, json: async () => [] })
    }
    if (url.includes("/documents/demo-document")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: "demo-document",
          workspaceId: "ws-1",
          title: "Demo",
        }),
      })
    }
    if (url.endsWith("/documents")) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })
}

/** 收藏/回收站已收进「浏览」下拉，先展开菜单再点对应项 */
async function openBrowseMenu() {
  fireEvent.click(screen.getByRole("button", { name: "浏览" }))
  await waitFor(() => {
    expect(screen.getByRole("menuitem", { name: "收藏" })).toBeInTheDocument()
  })
}

async function clickFavoritesShortcut() {
  await openBrowseMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: "收藏" }))
}

async function clickTrashShortcut() {
  await openBrowseMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: "回收站" }))
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
    const fetchMock = createShellFetchMock()
    vi.stubGlobal("fetch", fetchMock)

    render(<WorkspaceShell {...props} />)
    await waitFor(() =>
      expect(screen.getByText("我的知识库")).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole("button", { name: /新建文档/ }))

    // The implementation includes credentials: 'include' so assert using
    // objectContaining to avoid brittle exact-object matching while still
    // verifying the important request parts (method and headers).
    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([url, options]) =>
          (options as RequestInit | undefined)?.method === "POST" &&
          String(url).includes("/workspaces/ws-1/documents")
      )
      expect(postCall?.[0]).toBe(
        buildClientApiUrl("/workspaces/ws-1/documents")
      )
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
    const fetchMock = createShellFetchMock((_url, options) => {
      if (
        String(_url).includes("/workspaces/ws-1/documents") &&
        (options?.method ?? "GET") === "GET"
      ) {
        return {
          ok: true,
          json: async () => [{ id: "first", title: "First", role: "owner" }],
        }
      }
      return null
    })
    vi.stubGlobal("fetch", fetchMock)

    const { unmount } = render(<WorkspaceShell {...props} />)
    await waitFor(() =>
      expect(screen.getAllByText("First").length).toBeGreaterThan(0)
    )
    const callsAfterMount = fetchMock.mock.calls.length

    unmount()
    render(<WorkspaceShell {...props} documentId="another-document" />)
    expect(screen.getAllByText("First").length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterMount)
    )
  })

  it("shows a clear error when document creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (
          String(url).includes("/workspaces/ws-1/documents") &&
          options?.method === "POST"
        ) {
          return Promise.reject(new TypeError("Failed to fetch"))
        }
        return createShellFetchMock()(url, options)
      })
    )
    render(<WorkspaceShell {...props} />)
    await waitFor(() =>
      expect(screen.getByText("我的知识库")).toBeInTheDocument()
    )
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

    await clickFavoritesShortcut()

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

    await clickFavoritesShortcut()
    await waitFor(() => {
      expect(screen.getByTestId("favorites-panel")).toBeInTheDocument()
    })

    await clickFavoritesShortcut()
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

    await clickTrashShortcut()
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "浏览" })).toBeInTheDocument()
    )

    await clickTrashShortcut()
    await waitFor(() => {
      expect(screen.getByTestId("trash-panel")).toBeInTheDocument()
    })

    await clickTrashShortcut()
    expect(screen.getByTestId("trash-panel")).toBeInTheDocument()
  })
})

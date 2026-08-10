import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkspaceShell } from "./workspace-shell"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

vi.mock("./document-workspace", () => ({
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
})

describe("WorkspaceShell", () => {
  it("navigates to the created document URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-document" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<WorkspaceShell {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /新建文档/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:3100/documents",
        {
          method: "POST",
          headers: { "x-dev-user-id": "demo-owner" },
        }
      )
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/documents/new-document")
    })
  })

  it("shows a clear error when document creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )
    render(<WorkspaceShell {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /新建文档/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "无法连接到文档服务"
    )
    expect(screen.getByRole("button", { name: /新建文档/ })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })
})

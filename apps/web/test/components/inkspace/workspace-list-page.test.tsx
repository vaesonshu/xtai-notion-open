import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WorkspaceListPage } from "@/components/inkspace/workspace-list-page"

describe("WorkspaceListPage", () => {
  it("renders workspace cards with document counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "ws-1",
            name: "产品知识库",
            memberCount: 4,
            documentCount: 12,
            role: "owner",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      })
    )

    render(<WorkspaceListPage userId="user-1" />)

    expect(await screen.findByText("产品知识库")).toBeInTheDocument()
    expect(screen.getByText("12 篇文档")).toBeInTheDocument()
    expect(screen.getByText("4 位成员")).toBeInTheDocument()
  })

  it("filters workspaces by search query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "ws-1",
            name: "产品知识库",
            memberCount: 1,
            documentCount: 1,
            role: "owner",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          {
            id: "ws-2",
            name: "设计资料",
            memberCount: 2,
            documentCount: 3,
            role: "editor",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      })
    )

    render(<WorkspaceListPage userId="user-1" />)
    await screen.findByText("设计资料")

    fireEvent.change(screen.getByPlaceholderText("搜索知识库名称"), {
      target: { value: "产品" },
    })

    await waitFor(() => {
      expect(screen.getByText("产品知识库")).toBeInTheDocument()
      expect(screen.queryByText("设计资料")).not.toBeInTheDocument()
    })
  })
})

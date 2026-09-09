import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { WorkspaceMembersDialog } from "@/components/inkspace/workspace-members-dialog"
import { buildClientApiUrl } from "@/lib/api-client"

describe("WorkspaceMembersDialog", () => {
  it("loads members and opens invite search for owners", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/members/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              userId: "user-2",
              email: "member@example.com",
              displayName: "成员 B",
              color: "#24866B",
            },
          ],
        })
      }
      if (url.includes("/members")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              userId: "user-1",
              email: "owner@example.com",
              displayName: "所有者",
              color: "#242321",
              role: "owner",
            },
          ],
        })
      }
      return Promise.resolve({ ok: false, json: async () => ({}) })
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <WorkspaceMembersDialog
        open
        onOpenChange={vi.fn()}
        workspaceId="ws-1"
        workspaceName="产品知识库"
        currentUserId="user-1"
        currentUserRole="owner"
        userId="user-1"
      />
    )

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("搜索邮箱或昵称"), {
      target: { value: "member" },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        buildClientApiUrl("/workspaces/ws-1/members/search?q=member"),
        expect.objectContaining({ credentials: "include" })
      )
    })
    expect(await screen.findByText("成员 B")).toBeInTheDocument()
  })

  it("hides invite controls for viewers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }))

    render(
      <WorkspaceMembersDialog
        open
        onOpenChange={vi.fn()}
        workspaceId="ws-1"
        workspaceName="产品知识库"
        currentUserId="user-3"
        currentUserRole="viewer"
        userId="user-3"
      />
    )

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("搜索邮箱或昵称")
      ).not.toBeInTheDocument()
    })
  })
})

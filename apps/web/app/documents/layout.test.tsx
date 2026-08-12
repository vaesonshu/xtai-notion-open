import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"
import DocumentsLayout from "./layout"

let documentId = "first"
const mounted = vi.fn()
const workspaceShell = vi.fn()

vi.mock("next/navigation", () => ({
  useParams: () => ({ documentId }),
}))

vi.mock("../../components/inkspace/workspace-shell", () => ({
  WorkspaceShell: ({
    documentId: id,
    user,
  }: {
    documentId: string
    user: { id: string }
  }) => {
    workspaceShell({ documentId: id, user })
    useEffect(() => {
      mounted()
    }, [])
    return <div data-testid="workspace-shell">{id}</div>
  },
}))

vi.mock("../../components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "member-1", name: "Member", color: "#24866B" },
    loading: false,
  }),
}))

describe("DocumentsLayout", () => {
  it("keeps the workspace shell mounted while the document route changes", () => {
    const view = render(<DocumentsLayout>content</DocumentsLayout>)

    expect(screen.getByTestId("workspace-shell")).toHaveTextContent("first")
    // The editor must use the authenticated owner rather than the legacy
    // demo identity so new personal documents pass the API membership check.
    expect(workspaceShell).toHaveBeenLastCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: "member-1" }),
      })
    )

    documentId = "second"
    view.rerender(<DocumentsLayout>content</DocumentsLayout>)

    expect(screen.getByTestId("workspace-shell")).toHaveTextContent("second")
    expect(mounted).toHaveBeenCalledTimes(1)
  })
})

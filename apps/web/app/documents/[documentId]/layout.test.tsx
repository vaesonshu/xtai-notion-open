import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DocumentWorkspaceLayout from "./layout"

vi.mock("next/navigation", () => ({
  useParams: () => ({ documentId: "route-document" }),
}))

vi.mock("../../../components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Lin", color: "#24866B" },
    loading: false,
  }),
}))

vi.mock("../../../components/inkspace/workspace-shell", () => ({
  WorkspaceShell: ({ documentId }: { documentId: string }) => (
    <div
      data-testid="workspace-document"
      data-workspace-document-id={documentId}
    />
  ),
}))

describe("DocumentWorkspaceLayout", () => {
  it("renders the workspace for the document identified by the route parameter", () => {
    render(<DocumentWorkspaceLayout />)

    expect(screen.getByTestId("workspace-document")).toHaveAttribute(
      "data-workspace-document-id",
      "route-document"
    )
  })
})

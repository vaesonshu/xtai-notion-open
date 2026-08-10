import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DocumentPage from "./page"

vi.mock("../../../components/inkspace/workspace-shell", () => ({
  WorkspaceShell: ({ documentId }: { documentId: string }) => (
    <div data-document-id={documentId} data-testid="workspace-shell" />
  ),
}))

describe("DocumentPage", () => {
  it("opens the document identified by the route parameter", async () => {
    render(
      await DocumentPage({
        params: Promise.resolve({ documentId: "route-document" }),
      })
    )

    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-document-id",
      "route-document"
    )
  })
})

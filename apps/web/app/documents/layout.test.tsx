import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"
import DocumentsLayout from "./layout"

let documentId = "first"
const mounted = vi.fn()

vi.mock("next/navigation", () => ({
  useParams: () => ({ documentId }),
}))

vi.mock("../../components/inkspace/workspace-shell", () => ({
  WorkspaceShell: ({ documentId: id }: { documentId: string }) => {
    useEffect(() => {
      mounted()
    }, [])
    return <div data-testid="workspace-shell">{id}</div>
  },
}))

describe("DocumentsLayout", () => {
  it("keeps the workspace shell mounted while the document route changes", () => {
    const view = render(<DocumentsLayout>content</DocumentsLayout>)

    expect(screen.getByTestId("workspace-shell")).toHaveTextContent("first")

    documentId = "second"
    view.rerender(<DocumentsLayout>content</DocumentsLayout>)

    expect(screen.getByTestId("workspace-shell")).toHaveTextContent("second")
    expect(mounted).toHaveBeenCalledTimes(1)
  })
})

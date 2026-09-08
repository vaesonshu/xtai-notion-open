import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TrashPanel } from "@/components/inkspace/trash-panel"

describe("TrashPanel", () => {
  it("shows an empty state when there are no trashed documents", () => {
    render(<TrashPanel documents={[]} onRestore={vi.fn()} onPurge={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "回收站" })).toBeInTheDocument()
    expect(screen.getByText("回收站为空")).toBeInTheDocument()
  })

  it("restores a trashed document from the main panel", () => {
    const onRestore = vi.fn()
    render(
      <TrashPanel
        documents={[{ id: "trashed", title: "Deleted doc" }]}
        onRestore={onRestore}
        onPurge={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "恢复" }))
    expect(onRestore).toHaveBeenCalledWith("trashed")
  })
})

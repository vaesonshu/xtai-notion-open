import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FavoritesPanel } from "@/components/inkspace/favorites-panel"

describe("FavoritesPanel", () => {
  it("shows an empty state when there are no favorites", () => {
    render(<FavoritesPanel documents={[]} onSelectDocument={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "收藏" })).toBeInTheDocument()
    expect(screen.getByText("暂无收藏")).toBeInTheDocument()
  })

  it("opens a favorite document from the main panel", () => {
    const onSelectDocument = vi.fn()
    render(
      <FavoritesPanel
        documents={[{ id: "fav-1", title: "Favorite doc" }]}
        onSelectDocument={onSelectDocument}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Favorite doc" }))
    expect(onSelectDocument).toHaveBeenCalledWith("fav-1")
  })
})

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TableGridPicker } from "./table-grid-picker"

describe("TableGridPicker", () => {
  it("shows a default 4 × 4 label and commits the hovered dimensions on click", () => {
    const onSelect = vi.fn()
    render(<TableGridPicker onSelect={onSelect} />)

    expect(screen.getByTestId("table-grid-cell-0-0")).toHaveStyle({
      backgroundColor: "#FFFFFF",
    })

    // 默认标签反映默认高亮尺寸。
    expect(screen.getByText("4 × 4")).toBeInTheDocument()

    // 点击第 3 行第 5 列（0-based）=> 3 × 5。
    fireEvent.click(screen.getByTestId("table-grid-cell-2-4"))
    expect(onSelect).toHaveBeenCalledWith(3, 5)
  })

  it("updates the label on hover", () => {
    render(<TableGridPicker onSelect={() => {}} />)
    fireEvent.mouseEnter(screen.getByTestId("table-grid-cell-0-0"))
    expect(screen.getByText("1 × 1")).toBeInTheDocument()
    expect(screen.getByTestId("table-grid-cell-0-0")).toHaveStyle({
      backgroundColor: "#BFE6D0",
    })
  })

  it("expands the rendered grid when the pointer reaches its lower-right edge", () => {
    render(<TableGridPicker onSelect={() => {}} />)

    expect(screen.queryByTestId("table-grid-cell-4-4")).not.toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByTestId("table-grid-cell-3-3"))
    expect(screen.getByTestId("table-grid-cell-4-4")).toBeInTheDocument()
  })
})

import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { flattenDocuments, WorkspaceSidebar } from "./sidebar"

describe("WorkspaceSidebar selection states", () => {
  it("orders child documents directly below their parent", () => {
    expect(
      flattenDocuments([
        { id: "child", title: "Child", parentId: "root", depth: 2 },
        { id: "root", title: "Root", parentId: null, depth: 1 },
        { id: "grandchild", title: "Grandchild", parentId: "child", depth: 3 },
      ]).map((item) => item.id)
    ).toEqual(["root", "child", "grandchild"])
  })

  it("renders collaborative documents from API data", () => {
    render(
      <WorkspaceSidebar
        collaborativeDocuments={[{ id: "shared", title: "Shared project" }]}
      />
    )

    expect(screen.getByText("Shared project")).toBeInTheDocument()
    expect(screen.queryByText("产品与设计")).not.toBeInTheDocument()
  })

  it("collapses descendants when a parent toggle is clicked", () => {
    render(
      <WorkspaceSidebar
        documents={[
          { id: "root", title: "Root", parentId: null, depth: 1 },
          { id: "child", title: "Child", parentId: "root" },
        ]}
      />
    )

    expect(screen.getByText("Child")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "折叠子文档" }))
    expect(screen.queryByText("Child")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "展开子文档" }))
    expect(screen.getByText("Child")).toBeInTheDocument()
  })

  it("indents nested document rows by their depth", () => {
    render(
      <WorkspaceSidebar
        documents={[
          { id: "root", title: "Root", parentId: null, depth: 1 },
          { id: "child", title: "Child", parentId: "root", depth: 2 },
          {
            id: "grandchild",
            title: "Grandchild",
            parentId: "child",
          },
        ]}
      />
    )

    expect(screen.getByText("Root").parentElement?.parentElement).toHaveStyle({
      marginLeft: "0px",
    })
    expect(screen.getByText("Child").parentElement?.parentElement).toHaveStyle({
      marginLeft: "16px",
    })
    expect(
      screen.getByText("Grandchild").parentElement?.parentElement
    ).toHaveStyle({
      marginLeft: "32px",
    })
    expect(
      screen
        .getByText("Grandchild")
        .closest("button")
        ?.querySelector('span[aria-hidden="true"]')
    ).toBeInTheDocument()
  })

  it("starts without a highlighted shortcut and selects one on click", () => {
    render(<WorkspaceSidebar />)

    const buttons = screen.getAllByRole("button")
    const selected = buttons.filter(
      (button) => button.getAttribute("aria-current") === "page"
    )

    expect(selected).toHaveLength(0)

    const unselected = buttons.find(
      (button) => button.getAttribute("aria-current") !== "page"
    )
    expect(unselected).toBeDefined()
    expect(unselected).not.toHaveClass("!bg-[#E6F3EC]")
    expect(unselected).not.toHaveClass("!bg-[#EEF0EC]")

    fireEvent.click(unselected!)

    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-current") === "page")
    ).toHaveLength(1)
    expect(unselected).toHaveAttribute("aria-current", "page")
  })
})

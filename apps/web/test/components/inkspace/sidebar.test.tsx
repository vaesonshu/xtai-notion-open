import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  flattenDocuments,
  WorkspaceSidebar,
} from "@/components/inkspace/sidebar"

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

  it("navigates to the writing square from the browse menu", () => {
    const onOpenSquare = vi.fn()
    render(<WorkspaceSidebar onOpenSquare={onOpenSquare} />)

    fireEvent.click(screen.getByRole("button", { name: "浏览" }))
    fireEvent.click(screen.getByRole("menuitem", { name: /写作广场/ }))

    expect(onOpenSquare).toHaveBeenCalledOnce()
  })

  it("groups secondary navigation under the browse menu", () => {
    render(<WorkspaceSidebar onToggleTrash={vi.fn()} />)

    expect(screen.getByRole("button", { name: "浏览" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "回收站" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "浏览" }))
    expect(screen.getByRole("menuitem", { name: /回收站/ })).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: /文档图谱/ })
    ).toBeInTheDocument()
  })

  it("collapses the sidebar to an icon rail and hides document lists", () => {
    render(<WorkspaceSidebar documents={[{ id: "doc-a", title: "Doc A" }]} />)

    expect(screen.getByText("Doc A")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }))
    expect(screen.queryByText("Doc A")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "展开侧边栏" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }))
    expect(screen.getByText("Doc A")).toBeInTheDocument()
  })

  it("starts without a highlighted shortcut and selects one on click", () => {
    render(<WorkspaceSidebar />)

    const buttons = screen.getAllByRole("button")
    const selected = buttons.filter(
      (button) => button.getAttribute("aria-current") === "page"
    )

    expect(selected).toHaveLength(0)

    const searchButton = screen.getByRole("button", { name: /搜索/ })
    expect(searchButton).not.toHaveAttribute("aria-current", "page")

    fireEvent.click(searchButton)

    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-current") === "page")
    ).toHaveLength(1)
    expect(searchButton).toHaveAttribute("aria-current", "page")
  })
})

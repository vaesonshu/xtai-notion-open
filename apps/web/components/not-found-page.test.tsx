import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { NotFoundPage } from "./not-found-page"

describe("NotFoundPage", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the default 404 copy and workspace link", () => {
    render(<NotFoundPage />)

    expect(screen.getByText("404")).toBeInTheDocument()
    expect(screen.getByText("页面未找到")).toBeInTheDocument()
    expect(
      screen.getByText("你访问的页面不存在，或已被移动、删除。")
    ).toBeInTheDocument()

    // Button + Link 组合在可访问性树中呈现为 button 角色
    const homeLink = screen.getByRole("button", { name: "返回工作区" })
    expect(homeLink).toHaveAttribute("href", "/documents")
  })

  it("supports custom messaging and return target", () => {
    render(
      <NotFoundPage
        title="文章不存在"
        description="该文章可能尚未发布或已被撤回。"
        homeHref="/square"
        homeLabel="返回写作广场"
      />
    )

    expect(screen.getByText("文章不存在")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "返回写作广场" })
    ).toHaveAttribute("href", "/square")
  })
})

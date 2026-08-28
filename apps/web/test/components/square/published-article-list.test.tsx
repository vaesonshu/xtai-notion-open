import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PublishedArticleList } from "@/components/square/published-article-list"

describe("PublishedArticleList", () => {
  it("renders published articles returned by the public API", () => {
    render(
      <PublishedArticleList
        articles={[
          {
            id: "doc-1",
            title: "Published guide",
            author: "Ada",
            publishedAt: "2026-08-14T08:00:00.000Z",
            category: "个人空间",
          },
        ]}
      />
    )

    expect(screen.getByRole("link")).toHaveAttribute("href", "/square/doc-1")
    expect(screen.getByText("Ada")).toBeInTheDocument()
    expect(screen.getByText("个人空间")).toBeInTheDocument()
  })

  it("shows a clear empty state when no published articles exist", () => {
    render(<PublishedArticleList articles={[]} />)

    expect(screen.getByText("暂无已发布文章")).toBeInTheDocument()
  })
})

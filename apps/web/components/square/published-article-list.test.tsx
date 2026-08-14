import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PublishedArticleList } from "./published-article-list"

describe("PublishedArticleList", () => {
  it("renders published articles returned by the public API", () => {
    render(
      <PublishedArticleList
        articles={[
          {
            id: "doc-1",
            title: "Published guide",
            publishedAt: "2026-08-14T08:00:00.000Z",
          },
        ]}
      />
    )

    expect(screen.getByText("Published guide")).toBeInTheDocument()
  })

  it("shows a clear empty state when no published articles exist", () => {
    render(<PublishedArticleList articles={[]} />)

    expect(screen.getByText("暂无已发布文章")).toBeInTheDocument()
  })
})

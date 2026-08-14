import { describe, expect, it } from "vitest"

import { filterArticles, type Article } from "./article-management-page"

const articles: Article[] = [
  {
    id: "1",
    title: "使用 AI 提升团队效率",
    category: "产品动态",
    author: "林默",
    status: "已发布",
    publishedAt: "2026-08-12",
    views: 128,
  },
  {
    id: "2",
    title: "设计系统更新说明",
    category: "设计规范",
    author: "周宁",
    status: "草稿",
    publishedAt: "2026-08-10",
    views: 24,
  },
]

describe("filterArticles", () => {
  it("matches keyword across title, category, and author", () => {
    expect(
      filterArticles(articles, {
        query: "周宁",
        category: "全部",
        status: "全部",
      })
    ).toHaveLength(1)
  })

  it("combines category and status filters", () => {
    expect(
      filterArticles(articles, {
        query: "",
        category: "设计规范",
        status: "草稿",
      })
    ).toEqual([articles[1]])
  })

  it("returns no rows for an unmatched query", () => {
    expect(
      filterArticles(articles, {
        query: "不存在",
        category: "全部",
        status: "全部",
      })
    ).toHaveLength(0)
  })
})

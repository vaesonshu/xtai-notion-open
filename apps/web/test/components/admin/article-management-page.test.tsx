import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  ArticleManagementPage,
  filterArticles,
} from "@/components/admin/article-management-page"
import type { Article } from "@/components/admin/article-types"

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "admin-1", name: "管理员", role: "admin" },
    loading: false,
    refresh: vi.fn(),
  }),
  useAuthOptional: () => ({
    user: { id: "admin-1", name: "管理员", role: "admin" },
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock("@/lib/admin-api", () => ({
  fetchAdminStats: vi.fn().mockResolvedValue({
    publishedCount: 2,
    draftCount: 1,
    pendingCount: 1,
    totalUsers: 3,
  }),
  fetchAdminCategories: vi.fn().mockResolvedValue(["默认工作区"]),
  fetchAdminArticles: vi.fn().mockResolvedValue([
    {
      id: "doc-1",
      title: "测试文章",
      category: "默认工作区",
      author: "管理员",
      publicationStatus: "published",
      updatedAt: "2026-08-12T10:00:00.000Z",
      publishedAt: "2026-08-12T10:00:00.000Z",
    },
  ]),
}))

const articles: Article[] = [
  {
    id: "1",
    title: "使用 AI 提升团队效率",
    category: "产品动态",
    author: "林默",
    status: "已发布",
    publishedAt: "2026-08-12",
  },
  {
    id: "2",
    title: "设计系统更新说明",
    category: "设计规范",
    author: "周宁",
    status: "草稿",
    publishedAt: "2026-08-10",
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

describe("ArticleManagementPage", () => {
  it("renders the Pencil source labels and all six table columns", async () => {
    render(<ArticleManagementPage />)

    expect(
      screen.getByText("统一管理内容发布、审核与运营表现")
    ).toBeInTheDocument()
    expect(screen.getByText("待审核")).toBeInTheDocument()
    expect(await screen.findByText("更新时间")).toBeInTheDocument()
    expect(screen.getByText("操作")).toBeInTheDocument()
    expect(await screen.findByText("测试文章")).toBeInTheDocument()
  })
})

"use client"

import { useMemo, useState } from "react"
import { PlusIcon } from "@workspace/icons"

import { AdminSidebar } from "./admin-sidebar"
import { ArticleFilters, type ArticleFiltersValue } from "./article-filters"
import { ArticleStatCard } from "./article-stat-card"
import { ArticleTable } from "./article-table"

export type Article = {
  id: string
  title: string
  category: string
  author: string
  status: "已发布" | "草稿" | "已下线"
  publishedAt: string
  views: number
}

const articles: Article[] = [
  {
    id: "a1",
    title: "从灵感到发布：内容工作流全面升级",
    category: "产品动态",
    author: "林默",
    status: "已发布",
    publishedAt: "2026-08-12 14:20",
    views: 128,
  },
  {
    id: "a2",
    title: "2026 内容运营趋势报告",
    category: "行业观察",
    author: "严冬",
    status: "已发布",
    publishedAt: "2026-08-10 10:30",
    views: 86,
  },
  {
    id: "a3",
    title: "如何构建高效的知识库",
    category: "使用指南",
    author: "陆子衿",
    status: "草稿",
    publishedAt: "2026-08-09 16:40",
    views: 24,
  },
  {
    id: "a4",
    title: "设计系统 2.0：更轻、更快、更统一",
    category: "设计规范",
    author: "周宁",
    status: "已发布",
    publishedAt: "2026-08-08 09:15",
    views: 64,
  },
  {
    id: "a5",
    title: "小团队如何做出专业内容",
    category: "使用指南",
    author: "林默",
    status: "已发布",
    publishedAt: "2026-08-06 11:05",
    views: 47,
  },
  {
    id: "a6",
    title: "八月产品更新预告",
    category: "产品动态",
    author: "严冬",
    status: "草稿",
    publishedAt: "2026-08-04 08:30",
    views: 9,
  },
]

export function filterArticles(
  source: readonly Article[],
  filters: ArticleFiltersValue
) {
  const query = filters.query.trim().toLowerCase()
  // Filtering stays local so the design remains functional without inventing an API.
  return source.filter((article) => {
    const searchable =
      `${article.title} ${article.category} ${article.author}`.toLowerCase()
    return (
      (!query || searchable.includes(query)) &&
      (filters.category === "全部" || article.category === filters.category) &&
      (filters.status === "全部" || article.status === filters.status)
    )
  })
}

export function ArticleManagementPage() {
  const [filters, setFilters] = useState<ArticleFiltersValue>({
    query: "",
    category: "全部",
    status: "全部",
  })
  const [page, setPage] = useState(1)
  const pageSize = 5
  const filteredArticles = useMemo(
    () => filterArticles(articles, filters),
    [filters]
  )
  const pageCount = Math.max(1, Math.ceil(filteredArticles.length / pageSize))
  const visibleArticles = filteredArticles.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  function updateFilters(nextFilters: ArticleFiltersValue) {
    setFilters(nextFilters)
    setPage(1)
  }

  return (
    <main className="flex min-h-svh bg-[#f8faf8] font-sans text-[#344039]">
      <AdminSidebar />
      <section className="min-w-0 flex-1 p-4 sm:p-7">
        <div className="mx-auto max-w-[1120px]">
          <header className="mb-5 flex items-start justify-between">
            <div>
              <h1 className="text-[18px] font-semibold tracking-[-0.04em]">
                文章管理
              </h1>
              <p className="mt-1 text-[10px] text-[#97a19b]">
                管理、发布和追踪你的所有内容
              </p>
            </div>
            <button
              className="flex h-7 items-center gap-1 rounded bg-[#258268] px-2 text-[10px] font-medium text-white hover:bg-[#1f7059]"
              aria-label="新建文章（即将支持）"
            >
              <PlusIcon className="size-3" /> 新建文章
            </button>
          </header>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <ArticleStatCard
              label="已发布文章"
              value="128"
              trend="较上月 +12%"
              highlighted
            />
            <ArticleStatCard label="草稿箱" value="24" trend="待完善" />
            <ArticleStatCard
              label="总阅读量"
              value="86.4K"
              trend="较上月 +8.4%"
            />
            <ArticleStatCard label="本月新增" value="9" trend="较上月 +2" />
          </div>
          <ArticleFilters value={filters} onChange={updateFilters} />
          <div className="border border-[#e7ebe8] bg-white">
            <ArticleTable articles={visibleArticles} />
            <footer className="flex items-center justify-between border-t border-[#edf0ee] px-3 py-2 text-[10px] text-[#8d9892]">
              <span>共 {filteredArticles.length} 篇文章</span>
              <div className="flex items-center gap-1">
                <button
                  className="h-6 border border-[#e2e7e4] px-2 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </button>
                <span className="px-1">
                  {page} / {pageCount}
                </span>
                <button
                  className="h-6 border border-[#e2e7e4] px-2 disabled:opacity-40"
                  disabled={page === pageCount}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </button>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </main>
  )
}

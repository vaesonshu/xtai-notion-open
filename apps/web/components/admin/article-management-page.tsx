"use client"

import { useMemo, useState } from "react"
import { PlusIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"

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
    id: "ART-1024",
    title: "从零构建内容运营体系",
    category: "内容策略",
    author: "陈曦",
    status: "已发布",
    publishedAt: "2025-08-12 14:30",
    views: 0,
  },
  {
    id: "ART-1023",
    title: "2025 年产品设计趋势观察",
    category: "设计趋势",
    author: "林予",
    status: "已发布",
    publishedAt: "2025-08-11 11:20",
    views: 0,
  },
  {
    id: "ART-1022",
    title: "如何用数据驱动选题决策",
    category: "数据分析",
    author: "周启",
    status: "已发布",
    publishedAt: "2025-08-11 09:45",
    views: 0,
  },
  {
    id: "ART-1021",
    title: "新用户留存：从第一次体验开始",
    category: "用户研究",
    author: "陈曦",
    status: "已发布",
    publishedAt: "2025-08-11 09:30",
    views: 0,
  },
  {
    id: "ART-1020",
    title: "内容团队的协作工作流",
    category: "团队管理",
    author: "林予",
    status: "已发布",
    publishedAt: "2025-08-10 16:15",
    views: 0,
  },
]

export function filterArticles(
  source: readonly Article[],
  filters: ArticleFiltersValue
) {
  const query = filters.query.trim().toLowerCase()
  // The selection's appearance is static; filtering only changes which source rows are shown.
  return source.filter(
    (article) =>
      (!query ||
        `${article.title} ${article.author} ${article.id}`
          .toLowerCase()
          .includes(query)) &&
      (filters.category === "全部分类" ||
        filters.category === "全部" ||
        article.category === filters.category) &&
      (filters.status === "全部状态" ||
        filters.status === "全部" ||
        article.status === filters.status)
  )
}

export function ArticleManagementPage() {
  const [filters, setFilters] = useState<ArticleFiltersValue>({
    query: "",
    category: "全部分类",
    status: "全部状态",
  })
  const filtered = useMemo(() => filterArticles(articles, filters), [filters])
  return (
    <main className="h-[900px] w-[1440px] overflow-hidden bg-[#f8faf8] font-[Inter,system-ui,sans-serif] text-[#242522]">
      <div className="flex h-full">
        <AdminSidebar />
        <section className="flex h-full flex-1 flex-col gap-5 p-[28px_34px]">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-[26px] font-bold text-[#183e31]">文章管理</h1>
              <p className="mt-[5px] text-[13px] text-[#718179]">
                统一管理内容发布、审核与运营表现
              </p>
            </div>
            {/* Shared Button preserves the project's focus behavior without changing the Pencil dimensions. */}
            <Button
              type="button"
              variant="default"
              className="h-auto gap-[7px] rounded-[7px] bg-[#167251] px-[14px] py-[10px] text-[13px] font-semibold text-white hover:bg-[#167251]"
            >
              <PlusIcon className="size-[15px]" />
              新增文章
            </Button>
          </header>
          <div className="flex h-[104px] gap-3">
            <ArticleStatCard
              index={0}
              label="已发布文章"
              value="128"
              note="本月新增 18 篇"
            />
            <ArticleStatCard
              index={1}
              label="草稿箱"
              value="24"
              note="待完善 7 篇"
            />
            <ArticleStatCard
              index={2}
              label="总阅读量"
              value="86.4K"
              note="较上月 +12.8%"
            />
            <ArticleStatCard
              index={3}
              label="待审核"
              value="9"
              note="3 篇今日提交"
            />
          </div>
          <ArticleFilters value={filters} onChange={setFilters} />
          <section className="flex min-h-0 flex-1 flex-col">
            <ArticleTable articles={filtered} />
          </section>
        </section>
      </div>
    </main>
  )
}

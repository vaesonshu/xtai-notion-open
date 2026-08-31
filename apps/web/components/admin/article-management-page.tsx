"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PlusIcon } from "@workspace/icons"
import { toast, toastError } from "@/lib/toast"

import {
  fetchAdminArticles,
  fetchAdminCategories,
  fetchAdminStats,
} from "@/lib/admin-api"
import { useAuth } from "../auth-provider"
import { AdminShell } from "./admin-shell"
import { ArticleFilters, type ArticleFiltersValue } from "./article-filters"
import { ArticleStatCard } from "./article-stat-card"
import { ArticleTable } from "./article-table"
import { PublicationApprovalQueue } from "./publication-approval-queue"
import {
  STATUS_API_VALUE,
  STATUS_LABEL,
  formatAdminDateTime,
  type Article,
} from "./article-types"

export { filterArticles, type Article } from "./article-types"

export function ArticleManagementPage() {
  const auth = useAuth()
  const userId = auth.user?.id
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""

  const [filters, setFilters] = useState<ArticleFiltersValue>({
    query: "",
    category: "全部分类",
    status: "全部状态",
  })
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [stats, setStats] = useState({
    publishedCount: 0,
    draftCount: 0,
    pendingCount: 0,
    totalUsers: 0,
  })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [nextStats, nextCategories, nextArticles] = await Promise.all([
        fetchAdminStats(userId),
        fetchAdminCategories(userId),
        fetchAdminArticles(userId, {
          status: STATUS_API_VALUE[filters.status],
          category:
            filters.category === "全部分类" ? undefined : filters.category,
          query: filters.query.trim() || undefined,
        }),
      ])
      setStats(nextStats)
      setCategories(nextCategories)
      setArticles(
        nextArticles.map((article) => ({
          id: article.id,
          title: article.title,
          category: article.category,
          author: article.author ?? "—",
          status: STATUS_LABEL[article.publicationStatus],
          publishedAt: formatAdminDateTime(
            article.publishedAt ?? article.updatedAt
          ),
        }))
      )
    } catch (error) {
      toastError(error, "加载后台数据失败")
    } finally {
      setLoading(false)
    }
  }, [filters.category, filters.query, filters.status, userId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filtered = useMemo(() => articles, [articles])

  return (
    <AdminShell>
      <header className="flex shrink-0 items-center justify-between">
            <div>
              <h1 className="text-[26px] font-bold text-[#183e31]">文章管理</h1>
              <p className="mt-[5px] text-[13px] text-[#718179]">
                统一管理内容发布、审核与运营表现
              </p>
            </div>
            <Link
              href="/documents"
              className="inline-flex h-auto items-center gap-[7px] rounded-[7px] bg-[#167251] px-[14px] py-[10px] text-[13px] font-semibold text-white hover:bg-[#145e45]"
            >
              <PlusIcon className="size-[15px]" />
              前往文档创建
            </Link>
          </header>
          <div className="flex shrink-0 gap-3">
            <ArticleStatCard
              index={0}
              label="已发布文章"
              value={String(stats.publishedCount)}
              note={`草稿 ${stats.draftCount} 篇`}
            />
            <ArticleStatCard
              index={1}
              label="草稿箱"
              value={String(stats.draftCount)}
              note={`待审核 ${stats.pendingCount} 篇`}
            />
            <ArticleStatCard
              index={2}
              label="注册用户"
              value={String(stats.totalUsers)}
              note="平台用户总数"
            />
            <ArticleStatCard
              index={3}
              label="待审核"
              value={String(stats.pendingCount)}
              note="待处理发布申请"
            />
          </div>
          <ArticleFilters
            value={filters}
            onChange={setFilters}
            categories={categories}
            totalCount={filtered.length}
          />
          <PublicationApprovalQueue
            apiUrl={apiUrl}
            onChanged={() => void loadData()}
          />
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-[12px] text-[#74857c]">
                加载中…
              </div>
            ) : (
              <ArticleTable articles={filtered} />
            )}
          </section>
    </AdminShell>
  )
}

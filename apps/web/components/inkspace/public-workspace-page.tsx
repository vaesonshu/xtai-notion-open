"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  fetchPublicWorkspace,
  fetchPublicWorkspaceDocuments,
  type PublicWorkspaceDocumentSummary,
  type PublicWorkspaceView,
} from "@/lib/public-workspace-api"
import { toastError } from "@/lib/toast"

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
    new Date(value)
  )
}

/** 公开知识库只读目录：仅展示已发布文档。 */
export function PublicWorkspacePage({ workspaceId }: { workspaceId: string }) {
  const [workspace, setWorkspace] = useState<PublicWorkspaceView | null>(null)
  const [documents, setDocuments] = useState<PublicWorkspaceDocumentSummary[]>(
    []
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [ws, docs] = await Promise.all([
          fetchPublicWorkspace(workspaceId),
          fetchPublicWorkspaceDocuments(workspaceId),
        ])
        if (cancelled) return
        setWorkspace(ws)
        setDocuments(docs)
      } catch (error) {
        if (!cancelled) toastError(error, "无法加载公开知识库")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-sm text-[#78746C]">
        加载中…
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-[#78746C]">该知识库不存在或未公开。</p>
        <Button variant="link" className="mt-4 px-0" render={<Link href="/" />}>
          返回首页
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-semibold tracking-wide text-[#24866B] uppercase">
        公开知识库
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[#242321]">
        {workspace.name}
      </h1>
      <p className="mt-2 text-sm text-[#78746C]">
        以下均为已发布文档，未发布内容不会对外展示。
      </p>

      {documents.length === 0 ? (
        <p className="mt-10 text-sm text-[#78746C]">暂无已发布文档。</p>
      ) : (
        <ul className="mt-8 divide-y divide-[#ECEAE4] border-y border-[#ECEAE4]">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/square/${doc.id}`}
                className="flex flex-col gap-1 py-4 transition-colors hover:bg-[#FCFCFB] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-[#242321]">{doc.title}</span>
                <span className="text-xs text-[#78746C]">
                  {formatPublishedAt(doc.publishedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

"use client"

import Link from "next/link"
import { FileTextIcon, PlusIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import {
  WORKSPACE_ROLE_LABELS,
  type WorkspaceSummary,
} from "@/lib/workspace-api"

type WorkspaceDocument = {
  id: string
  title: string
  updatedAt?: string
  role?: string
}

export function WorkspaceHomePanel({
  workspace,
  documents,
  onCreateDocument,
  creatingDocument = false,
}: {
  workspace: WorkspaceSummary
  documents: readonly WorkspaceDocument[]
  onCreateDocument: () => void
  creatingDocument?: boolean
}) {
  // Copy before sort — ts lib is es2022 (no toSorted).
  const recentDocuments = [...documents].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return bTime - aTime
  })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-8 py-10">
      <header className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-[#78746C] uppercase">
          知识库
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{workspace.name}</h1>
        <p className="mt-2 text-sm text-[#78746C]">
          你的角色：{WORKSPACE_ROLE_LABELS[workspace.role]} ·{" "}
          {workspace.memberCount} 位成员 · {workspace.documentCount} 篇文档
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onCreateDocument} disabled={creatingDocument}>
            <PlusIcon className="size-4" />
            {creatingDocument ? "新建中…" : "新建文档"}
          </Button>
        </div>
      </header>

      <section className="mx-auto mt-10 w-full max-w-3xl">
        <h2 className="text-sm font-semibold text-[#78746C]">文档</h2>
        {recentDocuments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#ECEAE4] bg-white px-6 py-12 text-center">
            <p className="text-sm text-[#78746C]">这个知识库还没有文档</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={onCreateDocument}
              disabled={creatingDocument}
            >
              创建第一篇文档
            </Button>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[#ECEAE4] rounded-xl border border-[#ECEAE4] bg-white">
            {recentDocuments.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/documents/${document.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FCFCFB]"
                >
                  <FileTextIcon className="size-4 shrink-0 text-[#78746C]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {document.title || "未命名文档"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

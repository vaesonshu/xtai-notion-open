"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FolderIcon, PlusIcon, SearchIcon, UsersIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { CreateWorkspaceDialog } from "./create-workspace-dialog"
import { WorkspaceMembersDialog } from "./workspace-members-dialog"
import {
  canManageWorkspace,
  createWorkspace,
  fetchWorkspaces,
  WORKSPACE_ROLE_LABELS,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "@/lib/workspace-api"
import { toast, toastError } from "@/lib/toast"

type FilterMode = "all" | "managed" | "collaborative"
type SortMode = "updated" | "name" | "documents"

function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  })
}

export function WorkspaceListPage({ userId }: { userId: string }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterMode>("all")
  const [sort, setSort] = useState<SortMode>("updated")
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [membersWorkspace, setMembersWorkspace] =
    useState<WorkspaceSummary | null>(null)

  const loadWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      setWorkspaces(await fetchWorkspaces(userId))
    } catch (error) {
      toastError(error, "加载知识库失败")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    let items = workspaces.filter((item) =>
      keyword ? item.name.toLowerCase().includes(keyword) : true
    )
    if (filter === "managed") {
      items = items.filter((item) => canManageWorkspace(item.role))
    } else if (filter === "collaborative") {
      items = items.filter((item) => !canManageWorkspace(item.role))
    }
    // Copy before sort — ts lib is es2022 (no toSorted).
    return [...items].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN")
      if (sort === "documents") return b.documentCount - a.documentCount
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [filter, query, sort, workspaces])

  async function handleCreate(name: string) {
    setCreating(true)
    try {
      const workspace = await createWorkspace(userId, name)
      setWorkspaces((current) => [workspace, ...current])
      toast.success("知识库已创建")
    } catch (error) {
      toastError(error, "创建知识库失败")
      throw error
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-svh bg-[#F8F8F6] px-6 py-10 text-[#242321]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">知识库</h1>
            <p className="mt-1 text-sm text-[#78746C]">
              管理团队知识库，查看成员与文档概况
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            新建知识库
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[#78746C]" />
            <Input
              className="pl-8"
              placeholder="搜索知识库名称"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select
            items={[
              { value: "all", label: "全部" },
              { value: "managed", label: "我管理的" },
              { value: "collaborative", label: "我协作的" },
            ]}
            value={filter}
            onValueChange={(value) => setFilter(value as FilterMode)}
          >
            <SelectTrigger className="w-[128px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="managed">我管理的</SelectItem>
              <SelectItem value="collaborative">我协作的</SelectItem>
            </SelectContent>
          </Select>
          <Select
            items={[
              { value: "updated", label: "最近更新" },
              { value: "name", label: "名称" },
              { value: "documents", label: "文档数" },
            ]}
            value={sort}
            onValueChange={(value) => setSort(value as SortMode)}
          >
            <SelectTrigger className="w-[128px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">最近更新</SelectItem>
              <SelectItem value="name">名称</SelectItem>
              <SelectItem value="documents">文档数</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#ECEAE4] bg-white px-6 py-16 text-center">
            <p className="text-sm text-[#78746C]">
              {workspaces.length === 0
                ? "还没有知识库，先创建一个吧"
                : "没有匹配的知识库"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((workspace) => (
              <WorkspaceListCard
                key={workspace.id}
                workspace={workspace}
                onManageMembers={() => setMembersWorkspace(workspace)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        submitting={creating}
      />
      <WorkspaceMembersDialog
        open={membersWorkspace !== null}
        onOpenChange={(open) => {
          if (!open) setMembersWorkspace(null)
        }}
        workspaceId={membersWorkspace?.id ?? null}
        workspaceName={membersWorkspace?.name ?? "知识库"}
        workspaceVisibility={membersWorkspace?.visibility ?? "private"}
        currentUserId={userId}
        currentUserRole={membersWorkspace?.role}
        userId={userId}
        onMembersChanged={() => void loadWorkspaces()}
        onWorkspaceUpdated={() => void loadWorkspaces()}
      />
    </main>
  )
}

function WorkspaceListCard({
  workspace,
  onManageMembers,
}: {
  workspace: WorkspaceSummary
  onManageMembers: () => void
}) {
  const manageable = canManageWorkspace(workspace.role)

  return (
    <article className="flex flex-wrap items-center gap-4 rounded-xl border border-[#ECEAE4] bg-white px-5 py-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#242321] text-sm font-semibold text-white">
        {workspace.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/workspaces/${workspace.id}`}
          className="truncate text-base font-semibold hover:underline"
        >
          {workspace.name}
        </Link>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#78746C]">
          <span>{WORKSPACE_ROLE_LABELS[workspace.role]}</span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3.5" />
            {workspace.memberCount} 位成员
          </span>
          <span className="inline-flex items-center gap-1">
            <FolderIcon className="size-3.5" />
            {workspace.documentCount} 篇文档
          </span>
          <span>更新于 {formatRelativeTime(workspace.updatedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {manageable ? (
          <Button variant="outline" size="sm" onClick={onManageMembers}>
            成员
          </Button>
        ) : null}
        <Button
          render={<Link href={`/workspaces/${workspace.id}`} />}
          nativeButton={false}
          size="sm"
        >
          进入
        </Button>
      </div>
    </article>
  )
}

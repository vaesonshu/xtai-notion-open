"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowUpRightIcon,
  LibraryIcon,
  PlusIcon,
  UsersIcon,
} from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  createLibrary,
  fetchLibraries,
  LIBRARY_ROLE_LABELS,
  type LibrarySummary,
} from "@/lib/library-api"
import { toast, toastError } from "@/lib/toast"

export function LibraryListPage({ userId }: { userId: string }) {
  const [libraries, setLibraries] = useState<LibrarySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")

  const loadLibraries = useCallback(async () => {
    setLoading(true)
    try {
      setLibraries(await fetchLibraries(userId))
    } catch (error) {
      toastError(error, "加载资料库失败")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadLibraries()
  }, [loadLibraries])

  async function handleCreate() {
    // 与 POST /libraries 一致：只提交去掉首尾空白后的名称。
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const library = await createLibrary(userId, trimmed)
      setLibraries((current) => [library, ...current])
      setName("")
      setCreateOpen(false)
      toast.success("资料库已创建")
    } catch (error) {
      toastError(error, "创建资料库失败")
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#F8F8F6]">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#78746C] uppercase">
              Knowledge
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#242321]">
              资料库
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#78746C]">
              上传文档、建立向量索引，在同一处完成检索增强问答
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <PlusIcon className="size-4" />
            新建资料库
          </Button>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : libraries.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-[#ECEAE4] bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[#F3F2EE]">
              <LibraryIcon className="size-7 text-[#78746C]" />
            </div>
            <p className="mt-4 text-sm font-medium text-[#373532]">
              还没有资料库，先创建一个吧
            </p>
            <p className="mt-1 text-xs text-[#78746C]">
              每个资料库可独立配置嵌入模型与成员权限
            </p>
            <Button className="mt-6" onClick={() => setCreateOpen(true)}>
              新建资料库
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {libraries.map((library) => (
              <Link
                key={library.id}
                href={`/libraries/${library.id}`}
                className="group flex flex-col rounded-2xl border border-[#ECEAE4] bg-white p-5 shadow-sm transition hover:border-[#D8D4CC] hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#242321] text-sm font-semibold text-white">
                    {library.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-[#242321] group-hover:text-[#1B6B4F]">
                      {library.name}
                    </h2>
                    <p className="mt-1 text-xs text-[#78746C]">
                      {LIBRARY_ROLE_LABELS[library.role]}
                    </p>
                  </div>
                  <ArrowUpRightIcon className="size-4 shrink-0 text-[#C4C0B8] transition group-hover:text-[#78746C]" />
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#78746C]">
                  <span className="rounded-full bg-[#F3F2EE] px-2.5 py-1">
                    {library.sourceCount} 个来源
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F2EE] px-2.5 py-1">
                    <UsersIcon className="size-3" />
                    {library.memberCount} 人
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建资料库</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="资料库名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate()
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              取消
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

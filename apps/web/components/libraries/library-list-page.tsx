"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { PlusIcon } from "@workspace/icons"
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
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#F8F8F6] px-6 py-10 text-[#242321]">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">资料库</h1>
            <p className="mt-1 text-sm text-[#78746C]">
              管理可检索的文件来源，并基于资料库问答
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            新建资料库
          </Button>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : libraries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#ECEAE4] bg-white px-6 py-16 text-center">
            <p className="text-sm text-[#78746C]">还没有资料库，先创建一个吧</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {libraries.map((library) => (
              <article
                key={library.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-[#ECEAE4] bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#242321] text-sm font-semibold text-white">
                  {library.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/libraries/${library.id}`}
                    className="truncate text-base font-semibold hover:underline"
                  >
                    {library.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#78746C]">
                    <span>{LIBRARY_ROLE_LABELS[library.role]}</span>
                    <span>{library.sourceCount} 个来源</span>
                    <span>{library.memberCount} 位成员</span>
                  </div>
                </div>
                <Button
                  render={<Link href={`/libraries/${library.id}`} />}
                  nativeButton={false}
                  size="sm"
                >
                  进入
                </Button>
              </article>
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

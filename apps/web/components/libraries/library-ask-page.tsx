"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, MessageSquareIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { LibraryAskPanel } from "@/components/libraries/library-ask-panel"
import {
  fetchLibraries,
  fetchLibrary,
  fetchLibrarySources,
  LIBRARY_ROLE_LABELS,
  type LibrarySummary,
} from "@/lib/library-api"
import { toastError } from "@/lib/toast"

type LibraryAskPageProps = {
  userId: string
  /** 路由 /libraries/ask/[libraryId] 注入；未选库时只展示左侧列表。 */
  libraryId?: string
}

/** 资料库问答独立页：左侧选库，右侧对话（与来源管理页分离）。 */
export function LibraryAskPage({ userId, libraryId }: LibraryAskPageProps) {
  const router = useRouter()
  const [libraries, setLibraries] = useState<LibrarySummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [library, setLibrary] = useState<LibrarySummary | null>(null)
  const [readySourceCount, setReadySourceCount] = useState(0)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadLibraries = useCallback(async () => {
    setLoadingList(true)
    try {
      setLibraries(await fetchLibraries(userId))
    } catch (error) {
      toastError(error, "加载资料库失败")
    } finally {
      setLoadingList(false)
    }
  }, [userId])

  useEffect(() => {
    void loadLibraries()
  }, [loadLibraries])

  useEffect(() => {
    if (!libraryId) {
      setLibrary(null)
      setReadySourceCount(0)
      return
    }

    // 收窄类型：嵌套 async 内 TS 不会沿用上一行的 libraryId 守卫
    const activeLibraryId = libraryId

    let cancelled = false
    async function loadSelected() {
      setLoadingDetail(true)
      try {
        const [summary, sources] = await Promise.all([
          fetchLibrary(activeLibraryId, userId),
          fetchLibrarySources(activeLibraryId, userId),
        ])
        if (cancelled) return
        setLibrary(summary)
        setReadySourceCount(
          sources.filter((source) => source.status === "ready").length
        )
      } catch (error) {
        if (!cancelled) {
          toastError(error, "加载资料库失败")
          setLibrary(null)
        }
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    void loadSelected()
    return () => {
      cancelled = true
    }
  }, [libraryId, userId])

  function selectLibrary(id: string) {
    router.push(`/libraries/ask/${id}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#FCFCFA]">
      <header className="flex shrink-0 items-center gap-3 border-b border-[#ECEAE4] bg-white px-4 py-3 sm:px-5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-[#78746C]"
          render={<Link href="/libraries" />}
          nativeButton={false}
        >
          <ArrowLeftIcon className="size-4" />
          资料库
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-[#242321]">资料库问答</h1>
          <p className="text-xs text-[#78746C]">
            选择资料库后，基于已索引内容提问
          </p>
        </div>
        {libraryId ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            render={<Link href={`/libraries/${libraryId}`} />}
            nativeButton={false}
          >
            管理来源
          </Button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[40vh] min-h-0 shrink-0 flex-col border-b border-[#ECEAE4] bg-white md:max-h-none md:w-[280px] md:border-r md:border-b-0">
          <div className="shrink-0 border-b border-[#ECEAE4] px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-[#78746C] uppercase">
              选择资料库
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingList ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : libraries.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-[#78746C]">
                还没有资料库，请先在「资料库」中创建
              </p>
            ) : (
              <ul className="space-y-1">
                {libraries.map((item) => {
                  const selected = item.id === libraryId
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectLibrary(item.id)}
                        className={`flex w-full flex-col rounded-lg px-3 py-2.5 text-left transition ${
                          selected
                            ? "bg-[#E6F3EC] text-[#1B6B4F]"
                            : "text-[#242321] hover:bg-[#F3F2EF]"
                        }`}
                      >
                        <span className="truncate text-sm font-medium">
                          {item.name}
                        </span>
                        <span className="mt-0.5 text-[11px] text-[#78746C]">
                          {LIBRARY_ROLE_LABELS[item.role]} · {item.sourceCount}{" "}
                          个来源
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!libraryId ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#F3F2EE]">
                <MessageSquareIcon className="size-6 text-[#78746C]" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#373532]">
                请从左侧选择一个资料库
              </p>
            </div>
          ) : loadingDetail && !library ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : library ? (
            <LibraryAskPanel
              libraryId={libraryId}
              userId={userId}
              readySourceCount={readySourceCount}
              embeddingHint={
                library.role !== "owner" && !library.embeddingConfigured
                  ? "请联系资料库所有者配置嵌入模型"
                  : null
              }
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="text-sm text-[#78746C]">资料库不存在或无权访问</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

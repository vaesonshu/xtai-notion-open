"use client"

import { useAuth } from "../../components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast, toastError } from "@/lib/toast"
import { apiRequest, apiRequestJson } from "@/lib/api-client"

type DocumentListItem = {
  id: string
  role?: "owner" | "editor" | "viewer"
}

// React Strict Mode remounts this page in dev; share one bootstrap promise per
// user so an empty account does not POST two default documents.
const bootstrapDocumentByUser = new Map<string, Promise<string>>()

/** 打开首篇文档；若无任何文档则自动创建一篇（服务端会确保默认知识库）。 */
export async function resolveDocumentsEntryTarget(
  userId: string
): Promise<string> {
  const documents = await apiRequestJson<DocumentListItem[]>({
    path: "/documents",
    userId,
  })
  const firstDocument = documents[0]
  if (firstDocument?.id) return firstDocument.id

  const document = await apiRequestJson<{ id?: string }>({
    path: "/documents",
    method: "POST",
    userId,
  })
  if (!document.id) {
    throw new Error("新建文档响应无效")
  }
  return document.id
}

function bootstrapDocumentsEntry(userId: string): Promise<string> {
  const existing = bootstrapDocumentByUser.get(userId)
  if (existing) return existing

  const promise = resolveDocumentsEntryTarget(userId).finally(() => {
    bootstrapDocumentByUser.delete(userId)
  })
  bootstrapDocumentByUser.set(userId, promise)
  return promise
}

/** @internal 测试用：重置 Strict Mode 去重缓存。 */
export function resetDocumentsEntryBootstrapForTests() {
  bootstrapDocumentByUser.clear()
}

// This route acts as the authenticated entry point so login no longer lands on
// the public demo document; it either opens the user's documents or creates one.
export default function DocumentsIndexPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login?returnTo=%2Fdocuments")
      return
    }
    const currentUserId = user.id

    let cancelled = false

    async function loadDocuments() {
      try {
        const target = await bootstrapDocumentsEntry(currentUserId)
        if (cancelled) return
        router.replace(`/documents/${target}`)
      } catch (caught) {
        if (!cancelled) {
          toastError(caught, "加载文档失败")
          setLoading(false)
        }
      }
    }

    void loadDocuments()

    return () => {
      cancelled = true
    }
  }, [authLoading, router, user])

  async function createDocument() {
    if (!user) return
    setLoading(true)
    try {
      const document = await apiRequestJson<{ id?: string }>({
        path: "/documents",
        method: "POST",
        userId: user.id,
      })
      if (!document.id) {
        throw new Error("新建文档响应无效")
      }
      router.replace(`/documents/${document.id}`)
    } catch (caught) {
      toastError(caught, "新建文档失败")
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">你的文档空间</h1>
          <p className="text-sm text-muted-foreground">
            这里会打开你最近使用的文档；如果还没有文档，可以先创建一个。
          </p>
        </div>
        <Button onClick={() => void createDocument()} disabled={!user}>
          新建文档
        </Button>
      </div>
    </div>
  )
}

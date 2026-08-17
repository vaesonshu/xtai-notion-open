"use client"

import { useAuth } from "../../components/auth-provider"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type DocumentListItem = {
  id: string
  role?: "owner" | "editor" | "viewer"
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
        const response = await fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
          credentials: "include",
          headers: { "x-dev-user-id": currentUserId },
        })
        if (!response.ok) {
          throw new Error(`Failed to load documents (${response.status})`)
        }

        const documents = (await response.json()) as DocumentListItem[]
        const firstDocument =
          documents.find((item) => item.role === "owner") ?? documents[0]

        if (cancelled) return

        if (firstDocument) {
          router.replace(`/documents/${firstDocument.id}`)
          return
        }

        setLoading(false)
      } catch (caught) {
        if (!cancelled) {
          toast.error(
            caught instanceof Error ? caught.message : "加载文档失败"
          )
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dev-user-id": user.id },
      })
      if (!response.ok) {
        throw new Error(`新建文档失败 (${response.status})`)
      }
      const document = (await response.json()) as { id?: string }
      if (!document.id) {
        throw new Error("新建文档响应无效")
      }
      router.replace(`/documents/${document.id}`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "新建文档失败")
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

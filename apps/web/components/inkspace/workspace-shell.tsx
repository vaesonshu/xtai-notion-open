"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import {
  DocumentWorkspace,
  type DocumentWorkspaceProps,
} from "./document-workspace"
import { WorkspaceSidebar } from "./sidebar"

type CreatedDocumentResponse = { id: string; title?: string }
type DocumentRole = "owner" | "editor" | "viewer"
type DocumentListItem = { id: string; title: string }
type SidebarDocument = DocumentListItem & {
  role: DocumentRole
  parentId: string | null
  depth: number
}

function normalizeDocumentHierarchy(
  items: Array<Partial<SidebarDocument> & DocumentListItem>
): SidebarDocument[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const depthOf = (
    item: (typeof items)[number],
    seen = new Set<string>()
  ): number => {
    if (!item.parentId || seen.has(item.id)) return 1
    const parent = byId.get(item.parentId)
    if (!parent) return 1
    seen.add(item.id)
    return Math.min(3, depthOf(parent, seen) + 1)
  }
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    role: item.role ?? "owner",
    parentId: item.parentId ?? null,
    depth: depthOf(item),
  }))
}

export function getDocumentIdAfterDeletion(
  documents: readonly DocumentListItem[],
  deletedId: string
): string | null {
  const index = documents.findIndex((item) => item.id === deletedId)
  if (index < 0 || documents.length <= 1) return null
  return documents[index + 1]?.id ?? documents[index - 1]?.id ?? null
}

export type WorkspaceShellProps = {
  documentId?: string
  openFirstDocument?: boolean
  user: DocumentWorkspaceProps["user"]
  apiUrl: string
  collaborationUrl: string
  /** 覆盖主内容区，用于文档图谱等全页视图 */
  children?: ReactNode
  /** 侧边栏高亮：文档编辑 / 图谱 / 广场 */
  activeNav?: "editor" | "graph" | "square"
}

function getCreationError(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "无法连接到文档服务，请确认 API 已启动。"
  }
  return error instanceof Error ? error.message : "新建文档失败。"
}

type DocumentsCache = {
  userId: string
  items: SidebarDocument[]
}

// 跨文档切换时复用同一份列表，避免壳层偶发重挂载导致侧边栏闪动。
let documentsCache: DocumentsCache | null = null

/** 测试用：重置文档列表缓存。 */
export function resetDocumentsCacheForTests() {
  documentsCache = null
}

export function WorkspaceShell({
  documentId,
  openFirstDocument = false,
  user,
  apiUrl,
  collaborationUrl,
  children,
  activeNav = "editor",
}: WorkspaceShellProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [documents, setDocuments] = useState<SidebarDocument[]>(() =>
    documentsCache?.userId === user.id ? documentsCache.items : []
  )
  const syncDocuments = useCallback(
    (updater: (current: SidebarDocument[]) => SidebarDocument[]) => {
      setDocuments((current) => {
        const next = updater(current)
        documentsCache = { userId: user.id, items: next }
        return next
      })
    },
    [user.id]
  )
  const personalDocuments = documents.filter((item) => item.role === "owner")
  const collaborativeDocuments = documents.filter(
    (item) => item.role !== "owner"
  )
  async function renameDocument(id: string, title: string) {
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/documents/${id}`,
        {
          method: "PATCH",
          // Include credentials so session cookie is sent in production.
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-dev-user-id": user.id,
          },
          body: JSON.stringify({ title }),
        }
      )
      if (!response.ok) throw new Error("重命名失败")
      const updated = (await response.json()) as { id: string; title: string }
      syncDocuments((current) =>
        current.map((item) =>
          item.id === id ? { ...item, title: updated.title } : item
        )
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重命名失败")
    }
  }
  async function deleteDocument(id: string) {
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/documents/${id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "x-dev-user-id": user.id },
        }
      )
      if (!response.ok) throw new Error("删除失败")
      syncDocuments((current) => current.filter((item) => item.id !== id))
      if (id === documentId) {
        const nextDocumentId = getDocumentIdAfterDeletion(personalDocuments, id)
        router.push(nextDocumentId ? `/documents/${nextDocumentId}` : "/")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }
  useEffect(() => {
    if (!apiUrl) return
    if (documentsCache?.userId === user.id) {
      setDocuments(documentsCache.items)
      return
    }

    let cancelled = false
    void fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
      credentials: "include",
      headers: { "x-dev-user-id": user.id },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: Array<Partial<SidebarDocument> & DocumentListItem>) => {
        if (cancelled) return
        const normalized = normalizeDocumentHierarchy(items)
        documentsCache = { userId: user.id, items: normalized }
        setDocuments(normalized)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [apiUrl, user.id])

  useEffect(() => {
    if (!openFirstDocument) return
    const firstDocument =
      documents.find((item) => item.role === "owner") ?? documents[0]
    if (firstDocument) router.replace(`/documents/${firstDocument.id}`)
  }, [documents, openFirstDocument, router])

  async function createDocument() {
    setCreating(true)
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dev-user-id": user.id },
      })
      if (!response.ok) {
        throw new Error(`新建文档失败 (${response.status})`)
      }
      const document = (await response.json()) as CreatedDocumentResponse
      if (!document.id) {
        throw new Error("新建文档响应无效")
      }
      syncDocuments((current) => [
        ...current.filter((item) => item.id !== document.id),
        {
          id: document.id,
          title: document.title || "未命名文档",
          role: "owner",
          parentId: null,
          depth: 1,
        },
      ])
      router.push(`/documents/${document.id}`)
    } catch (error) {
      toast.error(getCreationError(error))
    } finally {
      setCreating(false)
    }
  }

  async function createChildDocument(parentId: string) {
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/documents`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-dev-user-id": user.id,
          "content-type": "application/json",
        },
        body: JSON.stringify({ parentId }),
      })
      if (!response.ok) throw new Error("创建子文档失败")
      const document = (await response.json()) as SidebarDocument
      syncDocuments((current) => [...current, document])
      router.push(`/documents/${document.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建子文档失败")
    }
  }

  return (
    <>
      <WorkspaceSidebar
        documents={personalDocuments}
        collaborativeDocuments={collaborativeDocuments}
        selectedDocumentId={documentId}
        activeNav={activeNav}
        onSelectDocument={(id) => router.push(`/documents/${id}`)}
        onCreateDocument={createDocument}
        creatingDocument={creating}
        onRenameDocument={renameDocument}
        onDeleteDocument={deleteDocument}
        onCreateChildDocument={(id) => void createChildDocument(id)}
        onOpenSquare={() => router.push("/square")}
        onOpenGraph={() => router.push("/documents/graph")}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-[#FCFCFA] !text-[#242321]">
        {children ??
          (documentId ? (
            <DocumentWorkspace
              key={documentId}
              documentId={documentId}
              user={user}
              apiUrl={apiUrl}
              collaborationUrl={collaborationUrl}
              mentionNavigate={(href: string) => router.push(href)}
              title={documents.find((item) => item.id === documentId)?.title}
              parentTitle={(() => {
                const current = documents.find((item) => item.id === documentId)
                return current?.parentId
                  ? documents.find((item) => item.id === current.parentId)
                      ?.title
                  : undefined
              })()}
            />
          ) : null)}
      </main>
    </>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type { WorkspaceAiSettings } from "@/lib/article-agent-types"
import { apiRequest } from "@/lib/api-client"
import { toast, toastError, getToastErrorMessage } from "@/lib/toast"
import {
  DocumentWorkspace,
  type DocumentWorkspaceProps,
} from "./document-workspace"
import { DocumentSearchDialog } from "./document-search-dialog"
import { FavoritesPanel } from "./favorites-panel"
import { TrashPanel } from "./trash-panel"
import { PersonalCenterDialog } from "../personal-center-dialog"
import { PersonalCenterProvider } from "../personal-center-context"
import { CreateWorkspaceDialog } from "./create-workspace-dialog"
import { WorkspaceHomePanel } from "./workspace-home-panel"
import {
  WorkspaceMembersDialog,
  type WorkspaceRole,
} from "./workspace-members-dialog"
import { WorkspaceSidebar } from "./sidebar"

const WORKSPACE_STORAGE_KEY = "inkspace:workspace:v1"

type CreatedDocumentResponse = {
  id: string
  title?: string
  workspaceId?: string
}
type DocumentRole = "owner" | "editor" | "viewer"
type DocumentListItem = { id: string; title: string }

const DEFAULT_AI_SETTINGS: WorkspaceAiSettings = { aiProvider: "cloud" }

type WorkspaceSummary = {
  id: string
  name: string
  memberCount: number
  documentCount: number
  role: WorkspaceRole
  aiSettings: WorkspaceAiSettings
  createdAt?: string
  updatedAt?: string
}
type SidebarDocument = DocumentListItem & {
  role: DocumentRole
  parentId: string | null
  depth: number
  workspaceId?: string
  isFavorite?: boolean
}

function readStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistWorkspaceId(workspaceId: string) {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId)
  } catch {
    // 隐私模式或禁用 storage 时忽略
  }
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
    workspaceId: item.workspaceId,
    isFavorite: item.isFavorite ?? false,
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
  /** 路由 /workspaces/:id 注入的当前库，优先于 localStorage */
  initialWorkspaceId?: string
  /** 展示知识库首页（文档列表 + 新建入口） */
  showWorkspaceHome?: boolean
  user: DocumentWorkspaceProps["user"]
  apiUrl: string
  collaborationUrl: string
  /** 覆盖主内容区，用于文档图谱等全页视图 */
  children?: ReactNode
  /** 侧边栏高亮：文档编辑 / 图谱 / 广场 / 知识库 */
  activeNav?: "editor" | "graph" | "square" | "workspaces"
  onOpenWorkspaces?: () => void
  onWorkspaceSwitch?: (workspaceId: string) => void
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
  initialWorkspaceId,
  showWorkspaceHome = false,
  user,
  apiUrl,
  collaborationUrl,
  children,
  activeNav = "editor",
  onOpenWorkspaces,
  onWorkspaceSwitch,
}: WorkspaceShellProps) {
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [importingMarkdown, setImportingMarkdown] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [trashedDocuments, setTrashedDocuments] = useState<SidebarDocument[]>(
    []
  )
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    null
  )
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [documents, setDocuments] = useState<SidebarDocument[]>(() =>
    documentsCache?.userId === user.id ? documentsCache.items : []
  )
  const currentWorkspace = workspaces.find(
    (item) => item.id === currentWorkspaceId
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
  const favoriteDocuments = documents.filter((item) => item.isFavorite)

  const closeLibraryViews = useCallback(() => {
    setShowFavorites(false)
    setShowTrash(false)
  }, [])

  const refreshWorkspaces = useCallback(async () => {
    if (!apiUrl) return null
    const response = await apiRequest({ path: "/workspaces", userId: user.id })
    if (!response.ok) return null
    const items = ((await response.json()) as WorkspaceSummary[]).map(
      (item) => ({
        ...item,
        aiSettings: item.aiSettings ?? DEFAULT_AI_SETTINGS,
      })
    )
    setWorkspaces(items)
    const stored = readStoredWorkspaceId()
    const nextId =
      items.find((item) => item.id === initialWorkspaceId)?.id ??
      items.find((item) => item.id === stored)?.id ??
      items.find((item) => item.role === "owner")?.id ??
      items[0]?.id ??
      null
    if (nextId) {
      setCurrentWorkspaceId(nextId)
      persistWorkspaceId(nextId)
    }
    return nextId
  }, [apiUrl, initialWorkspaceId, user.id])

  const refreshDocuments = useCallback(
    async (workspaceId?: string | null) => {
      if (!apiUrl) return
      const targetWorkspaceId = workspaceId ?? currentWorkspaceId
      const [activeResponse, trashResponse] = await Promise.all([
        targetWorkspaceId
          ? apiRequest({
              path: `/workspaces/${targetWorkspaceId}/documents`,
              userId: user.id,
            })
          : apiRequest({ path: "/documents", userId: user.id }),
        apiRequest({ path: "/documents/trash", userId: user.id }),
      ])
      const activeItems = activeResponse.ok
        ? ((await activeResponse.json()) as Array<
            Partial<SidebarDocument> &
              DocumentListItem & {
                workspaceId?: string
                isFavorite?: boolean
              }
          >)
        : []
      const trashItems = trashResponse.ok
        ? ((await trashResponse.json()) as Array<
            Partial<SidebarDocument> & DocumentListItem
          >)
        : []
      const normalized = normalizeDocumentHierarchy(activeItems)
      documentsCache = { userId: user.id, items: normalized }
      setDocuments(normalized)
      setTrashedDocuments(
        trashItems.map((item) => ({
          id: item.id,
          title: item.title || "未命名文档",
          role: (item.role as DocumentRole) ?? "owner",
          parentId: item.parentId ?? null,
          depth: item.depth ?? 1,
        }))
      )
    },
    [apiUrl, currentWorkspaceId, user.id]
  )

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      closeLibraryViews()
      setCurrentWorkspaceId(workspaceId)
      persistWorkspaceId(workspaceId)
      onWorkspaceSwitch?.(workspaceId)
      await refreshDocuments(workspaceId)
    },
    [closeLibraryViews, onWorkspaceSwitch, refreshDocuments]
  )

  useEffect(() => {
    if (!initialWorkspaceId || !apiUrl) return
    setCurrentWorkspaceId(initialWorkspaceId)
    persistWorkspaceId(initialWorkspaceId)
    void refreshDocuments(initialWorkspaceId)
  }, [apiUrl, initialWorkspaceId, refreshDocuments])

  async function createWorkspace(name: string) {
    setCreatingWorkspace(true)
    try {
      const response = await apiRequest({
        path: "/workspaces",
        method: "POST",
        userId: user.id,
        json: { name },
      })
      if (!response.ok) throw new Error("创建知识库失败")
      const workspace = (await response.json()) as WorkspaceSummary
      setWorkspaces((current) => [
        workspace,
        ...current.filter((item) => item.id !== workspace.id),
      ])
      await switchWorkspace(workspace.id)
      toast.success("知识库已创建")
    } catch (error) {
      toastError(error, "创建知识库失败")
    } finally {
      setCreatingWorkspace(false)
    }
  }
  async function toggleFavorite(id: string, isFavorite: boolean) {
    try {
      const response = await apiRequest({
        path: `/documents/${id}/pref`,
        method: "PATCH",
        userId: user.id,
        json: { isFavorite },
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => "")
        throw new Error(detail || "更新收藏失败")
      }
      const updated = (await response.json()) as { isFavorite?: boolean }
      const nextFavorite = updated.isFavorite ?? isFavorite
      syncDocuments((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isFavorite: nextFavorite } : item
        )
      )
      toast.success(nextFavorite ? "已加入收藏" : "已取消收藏")
    } catch (error) {
      toastError(error, "更新收藏失败")
    }
  }

  async function restoreDocument(id: string) {
    try {
      closeLibraryViews()
      const response = await apiRequest({
        path: `/documents/${id}/restore`,
        method: "POST",
        userId: user.id,
      })
      if (!response.ok) throw new Error("恢复失败")
      await refreshDocuments()
      router.push(`/documents/${id}`)
    } catch (error) {
      toastError(error, "恢复失败")
    }
  }

  async function purgeDocument(id: string) {
    try {
      const response = await apiRequest({
        path: `/documents/${id}/permanent`,
        method: "DELETE",
        userId: user.id,
      })
      if (!response.ok) throw new Error("永久删除失败")
      setTrashedDocuments((current) => current.filter((item) => item.id !== id))
    } catch (error) {
      toastError(error, "永久删除失败")
    }
  }

  async function importMarkdownFile(file: File) {
    if (importingMarkdown) return

    setImportingMarkdown(true)
    const toastId = toast.loading(`正在导入「${file.name}」…`)

    try {
      const markdown = await file.text()
      const title = file.name.replace(/\.md$/i, "") || "导入的文档"
      const response = await apiRequest({
        path: "/documents/import",
        method: "POST",
        userId: user.id,
        json: { title, markdown },
      })
      if (!response.ok) throw new Error("导入失败")
      const document = (await response.json()) as CreatedDocumentResponse
      await refreshDocuments()
      router.push(`/documents/${document.id}`)
      toast.success("Markdown 导入成功", { id: toastId })
    } catch (error) {
      toast.error(getToastErrorMessage(error, "导入失败"), { id: toastId })
    } finally {
      setImportingMarkdown(false)
    }
  }

  async function renameDocument(id: string, title: string) {
    try {
      const response = await apiRequest({
        path: `/documents/${id}`,
        method: "PATCH",
        userId: user.id,
        json: { title },
      })
      if (!response.ok) throw new Error("重命名失败")
      const updated = (await response.json()) as { id: string; title: string }
      syncDocuments((current) =>
        current.map((item) =>
          item.id === id ? { ...item, title: updated.title } : item
        )
      )
    } catch (error) {
      toastError(error, "重命名失败")
    }
  }
  async function deleteDocument(id: string) {
    try {
      const response = await apiRequest({
        path: `/documents/${id}`,
        method: "DELETE",
        userId: user.id,
      })
      if (!response.ok) throw new Error("删除失败")
      syncDocuments((current) => current.filter((item) => item.id !== id))
      void refreshDocuments()
      if (id === documentId) {
        const nextDocumentId = getDocumentIdAfterDeletion(personalDocuments, id)
        router.push(nextDocumentId ? `/documents/${nextDocumentId}` : "/")
      }
    } catch (error) {
      toastError(error, "删除失败")
    }
  }
  useEffect(() => {
    if (!apiUrl) return
    if (documentsCache?.userId === user.id) {
      setDocuments(documentsCache.items)
    }
    void (async () => {
      const workspaceId = await refreshWorkspaces()
      await refreshDocuments(workspaceId)
    })().catch(() => undefined)
  }, [apiUrl, refreshDocuments, refreshWorkspaces, user.id])

  useEffect(() => {
    if (!documentId || !apiUrl) return
    void (async () => {
      const response = await apiRequest({
        path: `/documents/${documentId}`,
        userId: user.id,
      })
      if (!response.ok) return
      const metadata = (await response.json()) as { workspaceId?: string }
      if (metadata.workspaceId && metadata.workspaceId !== currentWorkspaceId) {
        setCurrentWorkspaceId(metadata.workspaceId)
        persistWorkspaceId(metadata.workspaceId)
        await refreshDocuments(metadata.workspaceId)
      }
    })().catch(() => undefined)
  }, [apiUrl, currentWorkspaceId, documentId, refreshDocuments, user.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!openFirstDocument) return
    const firstDocument =
      documents.find((item) => item.role === "owner") ?? documents[0]
    if (firstDocument) router.replace(`/documents/${firstDocument.id}`)
  }, [documents, openFirstDocument, router])

  async function createDocument() {
    if (!currentWorkspaceId) {
      toast.error("请先选择或创建知识库")
      return
    }
    setCreating(true)
    try {
      const response = await apiRequest({
        path: `/workspaces/${currentWorkspaceId}/documents`,
        method: "POST",
        userId: user.id,
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
          workspaceId: document.workspaceId ?? currentWorkspaceId,
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
    if (!currentWorkspaceId) {
      toast.error("请先选择或创建知识库")
      return
    }
    try {
      const response = await apiRequest({
        path: `/workspaces/${currentWorkspaceId}/documents`,
        method: "POST",
        userId: user.id,
        json: { parentId },
      })
      if (!response.ok) throw new Error("创建子文档失败")
      const document = (await response.json()) as SidebarDocument
      syncDocuments((current) => [...current, document])
      router.push(`/documents/${document.id}`)
    } catch (error) {
      toastError(error, "创建子文档失败")
    }
  }

  return (
    <PersonalCenterProvider
      userId={user.id}
      workspaces={workspaces.map((item) => ({
        id: item.id,
        name: item.name,
        memberCount: item.memberCount,
        documentCount: item.documentCount ?? 0,
        role: item.role,
        aiSettings: item.aiSettings,
        createdAt: item.createdAt ?? "",
        updatedAt: item.updatedAt ?? "",
      }))}
      currentWorkspaceId={currentWorkspaceId}
      onRefreshWorkspaces={() => void refreshWorkspaces()}
    >
      <PersonalCenterDialog />
      <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
        <input
          ref={importInputRef}
          type="file"
          accept=".md,text/markdown"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importMarkdownFile(file)
            event.target.value = ""
          }}
        />
        <CreateWorkspaceDialog
          open={createWorkspaceOpen}
          onOpenChange={setCreateWorkspaceOpen}
          onSubmit={createWorkspace}
          submitting={creatingWorkspace}
        />
        <WorkspaceMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          workspaceId={currentWorkspaceId}
          workspaceName={currentWorkspace?.name ?? "知识库"}
          currentUserId={user.id}
          currentUserRole={currentWorkspace?.role}
          userId={user.id}
          onMembersChanged={() => void refreshWorkspaces()}
        />
        <DocumentSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          documents={documents}
          apiUrl={apiUrl}
          userId={user.id}
          onSelect={(id) => {
            closeLibraryViews()
            router.push(`/documents/${id}`)
          }}
        />
        <WorkspaceSidebar
          workspace={
            currentWorkspace
              ? {
                  id: currentWorkspace.id,
                  name: currentWorkspace.name,
                  memberCount: currentWorkspace.memberCount,
                }
              : undefined
          }
          workspaces={workspaces.map((item) => ({
            id: item.id,
            name: item.name,
            memberCount: item.memberCount,
          }))}
          onSwitchWorkspace={(id) => void switchWorkspace(id)}
          onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
          onManageMembers={() => setMembersOpen(true)}
          onOpenWorkspaces={
            onOpenWorkspaces ?? (() => router.push("/workspaces"))
          }
          documents={personalDocuments}
          collaborativeDocuments={collaborativeDocuments}
          showFavorites={showFavorites}
          showTrash={showTrash}
          selectedDocumentId={documentId}
          activeNav={activeNav}
          onSelectDocument={(id) => {
            closeLibraryViews()
            router.push(`/documents/${id}`)
          }}
          onCreateDocument={() => {
            closeLibraryViews()
            void createDocument()
          }}
          creatingDocument={creating}
          onRenameDocument={renameDocument}
          onDeleteDocument={deleteDocument}
          onCreateChildDocument={(id) => {
            closeLibraryViews()
            void createChildDocument(id)
          }}
          onOpenSquare={() => {
            closeLibraryViews()
            router.push("/square")
          }}
          onOpenGraph={() => {
            closeLibraryViews()
            router.push("/documents/graph")
          }}
          onOpenSearch={() => {
            closeLibraryViews()
            setSearchOpen(true)
          }}
          onToggleFavorites={() => {
            setShowTrash(false)
            setShowFavorites(true)
          }}
          onToggleTrash={() => {
            setShowFavorites(false)
            setShowTrash(true)
          }}
          onToggleFavorite={toggleFavorite}
        />
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#FCFCFA] !text-[#242321]">
          {children ??
            (showFavorites ? (
              <FavoritesPanel
                documents={favoriteDocuments}
                onSelectDocument={(id) => {
                  closeLibraryViews()
                  router.push(`/documents/${id}`)
                }}
              />
            ) : showTrash ? (
              <TrashPanel
                documents={trashedDocuments}
                onRestore={restoreDocument}
                onPurge={purgeDocument}
              />
            ) : showWorkspaceHome && currentWorkspaceId ? (
              <WorkspaceHomePanel
                workspace={{
                  id: currentWorkspaceId,
                  name: currentWorkspace?.name ?? "知识库",
                  memberCount: currentWorkspace?.memberCount ?? 0,
                  documentCount:
                    currentWorkspace?.documentCount ?? documents.length,
                  role: currentWorkspace?.role ?? "owner",
                  aiSettings:
                    currentWorkspace?.aiSettings ?? DEFAULT_AI_SETTINGS,
                  createdAt: currentWorkspace?.createdAt ?? "",
                  updatedAt: currentWorkspace?.updatedAt ?? "",
                }}
                documents={documents}
                onCreateDocument={() => void createDocument()}
                creatingDocument={creating}
              />
            ) : documentId ? (
              <DocumentWorkspace
                key={documentId}
                documentId={documentId}
                user={user}
                apiUrl={apiUrl}
                collaborationUrl={collaborationUrl}
                mentionDocuments={documents.map((item) => ({
                  id: item.id,
                  title: item.title,
                }))}
                mentionNavigate={(href: string) => router.push(href)}
                title={documents.find((item) => item.id === documentId)?.title}
                parentTitle={(() => {
                  const current = documents.find(
                    (item) => item.id === documentId
                  )
                  return current?.parentId
                    ? documents.find((item) => item.id === current.parentId)
                        ?.title
                    : undefined
                })()}
                onImportMarkdown={() => importInputRef.current?.click()}
                importingMarkdown={importingMarkdown}
                workspaceId={currentWorkspaceId ?? undefined}
                workspaceName={currentWorkspace?.name}
                aiSettings={
                  currentWorkspace?.aiSettings ?? DEFAULT_AI_SETTINGS
                }
              />
            ) : null)}
        </main>
      </div>
    </PersonalCenterProvider>
  )
}

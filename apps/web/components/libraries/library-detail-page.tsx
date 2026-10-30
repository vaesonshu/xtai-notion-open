"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, MessageSquareIcon, UsersIcon } from "@workspace/icons"
import { LibrarySourcePanel } from "@/components/libraries/library-source-panel"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  canEditLibrarySources,
  canManageLibraryMembers,
  deleteLibrary,
  deleteLibrarySource,
  fetchLibrary as defaultFetchLibrary,
  fetchLibraryMembers,
  fetchLibrarySources as defaultListSources,
  importLibraryDocument as defaultImportDocument,
  inviteLibraryMember,
  isAllowedLibraryFileName,
  LIBRARY_ROLE_LABELS,
  reindexLibrarySource,
  removeLibraryMember,
  searchReadableDocuments as defaultSearchDocuments,
  updateLibraryEmbedding,
  updateLibraryMemberRole,
  uploadLibrarySourceFile as defaultUploadSourceFile,
  type LibraryMember,
  type LibraryRole,
  type LibrarySource,
  type LibrarySummary,
  type ReadableDocumentHit,
} from "@/lib/library-api"
import { toast, toastError } from "@/lib/toast"

const DEFAULT_EMBEDDING_BASE_URL = "https://api.openai.com/v1"
const SOURCE_POLL_MS = 3000
const DOCUMENT_SEARCH_DEBOUNCE_MS = 200
const ASSIGNABLE_ROLES: Array<{
  value: Exclude<LibraryRole, "owner">
  label: string
}> = [
  { value: "admin", label: "管理员" },
  { value: "editor", label: "编辑者" },
  { value: "viewer", label: "查看者" },
]

type LibraryDetailPageProps = {
  libraryId: string
  userId: string
  fetchLibrary?: (libraryId: string, userId: string) => Promise<LibrarySummary>
  listSources?: (libraryId: string, userId: string) => Promise<LibrarySource[]>
  uploadSourceFile?: (
    libraryId: string,
    userId: string,
    file: File
  ) => Promise<{ id: string }>
  searchDocuments?: (
    query: string,
    userId: string
  ) => Promise<ReadableDocumentHit[]>
  importDocument?: (
    libraryId: string,
    userId: string,
    documentId: string
  ) => Promise<{ id: string }>
}

export function LibraryDetailPage({
  libraryId,
  userId,
  fetchLibrary = defaultFetchLibrary,
  listSources = defaultListSources,
  uploadSourceFile = defaultUploadSourceFile,
  searchDocuments = defaultSearchDocuments,
  importDocument = defaultImportDocument,
}: LibraryDetailPageProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [library, setLibrary] = useState<LibrarySummary | null>(null)
  const [sources, setSources] = useState<LibrarySource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [documentQuery, setDocumentQuery] = useState("")
  const [documentHits, setDocumentHits] = useState<ReadableDocumentHit[]>([])
  const [membersOpen, setMembersOpen] = useState(false)
  const [embeddingOpen, setEmbeddingOpen] = useState(false)

  const refreshSources = useCallback(async () => {
    const items = await listSources(libraryId, userId)
    setSources(items)
    return items
  }, [libraryId, listSources, userId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [summary, items] = await Promise.all([
          fetchLibrary(libraryId, userId),
          listSources(libraryId, userId),
        ])
        if (cancelled) return
        setLibrary(summary)
        setSources(items)
      } catch (error) {
        if (!cancelled) toastError(error, "加载资料库失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [fetchLibrary, libraryId, listSources, userId])

  useEffect(() => {
    const busy = sources.some(
      (source) => source.status === "queued" || source.status === "processing"
    )
    if (!busy) {
      // 没有 queued/processing 时停掉轮询，避免空转打 GET。
      return
    }
    const timer = window.setInterval(() => {
      void refreshSources()
    }, SOURCE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [refreshSources, sources])

  useEffect(() => {
    const trimmed = documentQuery.trim()
    if (!trimmed) {
      setDocumentHits([])
      return
    }
    // 按标题搜索当前用户可读文档，选中后再导入，避免粘贴 UUID。
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void searchDocuments(trimmed, userId)
        .then((items) => {
          if (!controller.signal.aborted) {
            setDocumentHits(items)
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setDocumentHits([])
            toastError(error, "搜索文档失败")
          }
        })
    }, DOCUMENT_SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [documentQuery, searchDocuments, userId])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!isAllowedLibraryFileName(file.name)) {
      setUploadError("只支持 txt、md、pdf、docx 文件")
      return
    }
    setUploadError(null)
    try {
      await uploadSourceFile(libraryId, userId, file)
      toast.success("已加入索引队列")
      await refreshSources()
    } catch (error) {
      toastError(error, "上传失败")
    }
  }

  async function handlePickDocument(documentId: string) {
    try {
      await importDocument(libraryId, userId, documentId)
      setDocumentQuery("")
      setDocumentHits([])
      toast.success("文档已导入")
      await refreshSources()
    } catch (error) {
      toastError(error, "导入文档失败")
    }
  }

  async function handleReindex(sourceId: string) {
    try {
      await reindexLibrarySource(libraryId, userId, sourceId)
      toast.success("已重新排队")
      await refreshSources()
    } catch (error) {
      toastError(error, "重新索引失败")
    }
  }

  async function handleDeleteSource(source: LibrarySource) {
    if (!window.confirm(`确定删除来源「${source.title}」？`)) return
    try {
      await deleteLibrarySource(libraryId, userId, source.id)
      toast.success("来源已删除")
      await refreshSources()
    } catch (error) {
      toastError(error, "删除来源失败")
    }
  }

  async function handleDeleteLibrary() {
    if (!window.confirm("确定删除该资料库？")) return
    try {
      await deleteLibrary(libraryId, userId)
      toast.success("资料库已删除")
      router.push("/libraries")
    } catch (error) {
      toastError(error, "删除资料库失败")
    }
  }

  if (loading && !library) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#FCFCFA]">
        <Spinner />
      </div>
    )
  }

  if (!library) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FCFCFA] px-6">
        <div className="rounded-xl border border-dashed border-[#ECEAE4] bg-white px-6 py-16 text-center">
          <p className="text-sm text-[#78746C]">资料库不存在或无权访问</p>
        </div>
      </div>
    )
  }

  const canEdit = canEditLibrarySources(library.role)
  const isOwner = library.role === "owner"
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#FCFCFA]">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#ECEAE4] bg-white px-4 py-3 sm:px-5">
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
          <h1 className="truncate text-lg font-semibold text-[#242321]">
            {library.name}
          </h1>
          <p className="text-xs text-[#78746C]">
            {LIBRARY_ROLE_LABELS[library.role]} · {library.sourceCount} 个来源 ·{" "}
            {library.memberCount} 位成员
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5"
            render={<Link href={`/libraries/ask/${libraryId}`} />}
            nativeButton={false}
          >
            <MessageSquareIcon className="size-3.5" />
            去问答
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setMembersOpen(true)}
          >
            <UsersIcon className="size-3.5" />
            成员
          </Button>
          {isOwner ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setEmbeddingOpen(true)}
            >
              嵌入配置
            </Button>
          ) : null}
          {isOwner ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[#78746C]"
              onClick={() => void handleDeleteLibrary()}
            >
              删除
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">
        <LibrarySourcePanel
          canEdit={canEdit}
          sources={sources}
          uploadError={uploadError}
          fileInputRef={fileInputRef}
          onFileChange={(event) => void handleFileChange(event)}
          documentQuery={documentQuery}
          onDocumentQueryChange={setDocumentQuery}
          documentHits={documentHits}
          onPickDocument={(documentId) => void handlePickDocument(documentId)}
          onReindex={(sourceId) => void handleReindex(sourceId)}
          onDeleteSource={(source) => void handleDeleteSource(source)}
        />
      </div>

      <LibraryMembersDialog
        open={membersOpen}
        onOpenChange={setMembersOpen}
        libraryId={libraryId}
        libraryName={library.name}
        currentUserId={userId}
        currentUserRole={library.role}
        userId={userId}
      />
      {isOwner ? (
        <LibraryEmbeddingDialog
          open={embeddingOpen}
          onOpenChange={setEmbeddingOpen}
          libraryId={libraryId}
          userId={userId}
          onModelChanged={refreshSources}
        />
      ) : null}
    </div>
  )
}

function LibraryMembersDialog({
  open,
  onOpenChange,
  libraryId,
  libraryName,
  currentUserId,
  currentUserRole,
  userId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  libraryName: string
  currentUserId: string
  currentUserRole: LibraryRole
  userId: string
}) {
  const [members, setMembers] = useState<LibraryMember[]>([])
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] =
    useState<Exclude<LibraryRole, "owner">>("editor")
  const manageable = canManageLibraryMembers(currentUserRole)

  const refreshMembers = useCallback(async () => {
    setLoading(true)
    try {
      setMembers(await fetchLibraryMembers(libraryId, userId))
    } catch (error) {
      toastError(error, "加载成员列表失败")
    } finally {
      setLoading(false)
    }
  }, [libraryId, userId])

  useEffect(() => {
    if (!open) return
    void refreshMembers()
  }, [open, refreshMembers])

  async function handleInvite() {
    const email = inviteEmail.trim()
    if (!email) return
    try {
      await inviteLibraryMember(libraryId, userId, {
        email,
        role: inviteRole,
      })
      setInviteEmail("")
      await refreshMembers()
      toast.success("成员已加入资料库")
    } catch (error) {
      toastError(error, "邀请失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{libraryName} · 成员</DialogTitle>
        </DialogHeader>
        {manageable ? (
          <div className="flex gap-2">
            <Input
              placeholder="成员邮箱"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleInvite()
              }}
            />
            <Select
              items={ASSIGNABLE_ROLES}
              value={inviteRole}
              onValueChange={(value) =>
                setInviteRole(value as Exclude<LibraryRole, "owner">)
              }
            >
              <SelectTrigger size="sm" className="w-[100px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => void handleInvite()}>
              邀请
            </Button>
          </div>
        ) : null}
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-sm text-[#78746C]">加载成员…</p>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#78746C]">暂无成员</p>
          ) : (
            members.map((member) => {
              const isOwner = member.role === "owner"
              const isSelf = member.userId === currentUserId
              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 rounded-lg px-1 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.displayName}
                      {isSelf ? (
                        <span className="ml-1 text-xs text-[#78746C]">
                          （你）
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-[#78746C]">
                      {member.email}
                    </p>
                  </div>
                  {manageable && !isOwner ? (
                    <Select
                      items={ASSIGNABLE_ROLES}
                      value={member.role}
                      onValueChange={(value) => {
                        void updateLibraryMemberRole(
                          libraryId,
                          userId,
                          member.userId,
                          value as Exclude<LibraryRole, "owner">
                        )
                          .then(() => refreshMembers())
                          .catch((error) => toastError(error, "更新角色失败"))
                      }}
                    >
                      <SelectTrigger size="sm" className="w-[96px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="shrink-0 text-xs text-[#78746C]">
                      {LIBRARY_ROLE_LABELS[member.role]}
                    </span>
                  )}
                  {manageable && !isOwner && !isSelf ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void removeLibraryMember(
                          libraryId,
                          userId,
                          member.userId
                        )
                          .then(() => refreshMembers())
                          .catch((error) => toastError(error, "移除成员失败"))
                      }}
                    >
                      移除
                    </Button>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LibraryEmbeddingDialog({
  open,
  onOpenChange,
  libraryId,
  userId,
  onModelChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  userId: string
  onModelChanged: () => Promise<LibrarySource[]>
}) {
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [model, setModel] = useState("")
  const [savedBaseUrl, setSavedBaseUrl] = useState("")
  const [savedModel, setSavedModel] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const nextModel = model.trim()
    const nextBase = baseUrl.trim()
    const nextKey = apiKey.trim()
    // 只对用户实际填写且与本会话上次保存值不同的模型/URL 确认重建。
    const modelChanged =
      (nextModel !== "" && nextModel !== savedModel) ||
      (nextBase !== "" && nextBase !== savedBaseUrl)
    if (modelChanged && !window.confirm("将按新模型重建全部来源")) {
      return
    }
    const patch: {
      openAiApiKey?: string
      openAiBaseUrl?: string
      openAiEmbeddingModel?: string
    } = {}
    if (nextModel) patch.openAiEmbeddingModel = nextModel
    // 空 Base URL 表示不改已保存地址，不能把占位默认值写进 PUT。
    if (nextBase) patch.openAiBaseUrl = nextBase
    // 空 Key 表示不改已保存的密钥，所以不要把空字符串交给 PUT。
    if (nextKey) patch.openAiApiKey = nextKey
    setSaving(true)
    try {
      const saved = await updateLibraryEmbedding(libraryId, userId, patch)
      if (nextModel) setSavedModel(nextModel)
      if (nextBase) setSavedBaseUrl(nextBase)
      setApiKey("")
      toast.success("嵌入配置已保存")
      if (saved.modelChanged) {
        await onModelChanged()
      }
      onOpenChange(false)
    } catch (error) {
      toastError(error, "保存嵌入配置失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>嵌入配置</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="library-embedding-key">API Key</Label>
            <Input
              id="library-embedding-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="已配置则留空不修改"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="library-embedding-base">Base URL</Label>
            <Input
              id="library-embedding-base"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={DEFAULT_EMBEDDING_BASE_URL}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="library-embedding-model">模型名称</Label>
            <Input
              id="library-embedding-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="例如 text-embedding-3-small"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import { useRouter } from "next/navigation"
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
import { LibraryAskPanel } from "@/components/libraries/library-ask-panel"
import {
  canEditLibrarySources,
  canManageLibraryMembers,
  deleteLibrary,
  deleteLibrarySource,
  fetchLibrary as defaultFetchLibrary,
  fetchLibraryMembers,
  fetchLibrarySources as defaultListSources,
  importLibraryDocument,
  inviteLibraryMember,
  isAllowedLibraryFileName,
  LIBRARY_ROLE_LABELS,
  reindexLibrarySource,
  removeLibraryMember,
  updateLibraryEmbedding,
  updateLibraryMemberRole,
  uploadLibrarySourceFile as defaultUploadSourceFile,
  type LibraryMember,
  type LibraryRole,
  type LibrarySource,
  type LibrarySummary,
} from "@/lib/library-api"
import { toast, toastError } from "@/lib/toast"

const DEFAULT_EMBEDDING_BASE_URL = "https://api.openai.com/v1"
const SOURCE_POLL_MS = 3000
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
}

export function LibraryDetailPage({
  libraryId,
  userId,
  fetchLibrary = defaultFetchLibrary,
  listSources = defaultListSources,
  uploadSourceFile = defaultUploadSourceFile,
}: LibraryDetailPageProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [library, setLibrary] = useState<LibrarySummary | null>(null)
  const [sources, setSources] = useState<LibrarySource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState("")
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

  async function handleImportDocument() {
    const trimmed = documentId.trim()
    if (!trimmed) return
    try {
      await importLibraryDocument(libraryId, userId, trimmed)
      setDocumentId("")
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
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!library) {
    return (
      <div className="rounded-xl border border-dashed border-[#ECEAE4] bg-white px-6 py-16 text-center">
        <p className="text-sm text-[#78746C]">资料库不存在或无权访问</p>
      </div>
    )
  }

  const canEdit = canEditLibrarySources(library.role)
  const isOwner = library.role === "owner"

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-8 py-10">
      <header className="mx-auto flex w-full max-w-4xl flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#78746C] uppercase">
            资料库
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{library.name}</h1>
          <p className="mt-2 text-sm text-[#78746C]">
            你的角色：{LIBRARY_ROLE_LABELS[library.role]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMembersOpen(true)}>
            成员
          </Button>
          {isOwner ? (
            <Button variant="outline" onClick={() => setEmbeddingOpen(true)}>
              嵌入配置
            </Button>
          ) : null}
          {isOwner ? (
            <Button
              variant="outline"
              onClick={() => void handleDeleteLibrary()}
            >
              删除资料库
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto mt-8 grid w-full max-w-4xl gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#78746C]">来源</h2>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(event) => void handleFileChange(event)}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                上传文件
              </Button>
              <Input
                className="w-[180px]"
                placeholder="文档 ID"
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => void handleImportDocument()}
              >
                导入文档
              </Button>
            </div>
          ) : null}
          {uploadError ? (
            <p className="text-sm text-[#B42318]">{uploadError}</p>
          ) : null}
          {sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ECEAE4] bg-white px-6 py-12 text-center">
              <p className="text-sm text-[#78746C]">还没有来源</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#ECEAE4] rounded-xl border border-[#ECEAE4] bg-white">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="flex flex-wrap items-center gap-2 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {source.title}
                    </p>
                    <p className="text-xs text-[#78746C]">
                      {source.statusLabel}
                    </p>
                    {source.errorMessage ? (
                      <p className="text-xs text-[#B42318]">
                        {source.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleReindex(source.id)}
                      >
                        重新索引
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteSource(source)}
                      >
                        删除
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <LibraryAskPanel
          libraryId={libraryId}
          userId={userId}
          embeddingHint={isOwner ? null : "请联系资料库所有者配置嵌入模型"}
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  userId: string
}) {
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState(DEFAULT_EMBEDDING_BASE_URL)
  const [model, setModel] = useState("")
  const [savedBaseUrl, setSavedBaseUrl] = useState(DEFAULT_EMBEDDING_BASE_URL)
  const [savedModel, setSavedModel] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const nextModel = model.trim()
    const nextBase = baseUrl.trim()
    const modelChanged = nextModel !== savedModel || nextBase !== savedBaseUrl
    if (modelChanged && !window.confirm("将按新模型重建全部来源")) {
      return
    }
    const patch: {
      openAiApiKey?: string
      openAiBaseUrl?: string
      openAiEmbeddingModel?: string
    } = {}
    if (nextModel) patch.openAiEmbeddingModel = nextModel
    if (nextBase) patch.openAiBaseUrl = nextBase
    // 空 Key 表示不改已保存的密钥，所以不要把空字符串交给 PUT。
    if (apiKey.trim()) patch.openAiApiKey = apiKey.trim()
    setSaving(true)
    try {
      await updateLibraryEmbedding(libraryId, userId, patch)
      setSavedModel(nextModel)
      setSavedBaseUrl(nextBase || DEFAULT_EMBEDDING_BASE_URL)
      setApiKey("")
      toast.success("嵌入配置已保存")
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

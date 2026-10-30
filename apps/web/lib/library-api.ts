/** 资料库 HTTP 客户端：走现有 apiRequestJson，不另开一套请求风格。 */
import {
  apiRequest,
  apiRequestJson,
  readApiErrorMessage,
} from "@/lib/api-client"

export type LibraryRole = "owner" | "admin" | "editor" | "viewer"

export type SourceStatus = "queued" | "processing" | "ready" | "failed"

export type LibrarySummary = {
  id: string
  name: string
  role: LibraryRole
  sourceCount: number
  memberCount: number
  updatedAt: string
  embeddingConfigured: boolean
}

export type LibrarySource = {
  id: string
  title: string
  kind: "file" | "document_snapshot"
  status: SourceStatus
  statusLabel: string
  errorMessage: string | null
  activeGeneration: number
}

export type LibraryMember = {
  userId: string
  email: string
  displayName: string
  color: string
  role: LibraryRole
}

export type LibraryCitation = {
  index: number
  sourceId: string
  sourceTitle: string
  heading: string | null
  page: number | null
  excerpt: string
  similarity: number
}

export type LibraryQaEvent =
  | {
      type: "citations"
      citations: LibraryCitation[]
      pendingSourceCount: number
    }
  | { type: "token"; content: string }
  | { type: "done" }
  | { type: "error"; message: string }

export type EmbeddingPatch = {
  openAiApiKey?: string
  openAiBaseUrl?: string
  openAiEmbeddingModel?: string
}

export type EmbeddingPublicView = {
  openAiBaseUrl: string
  openAiEmbeddingModel: string
  hasApiKey: boolean
  modelChanged: boolean
}

export const LIBRARY_ROLE_LABELS: Record<LibraryRole, string> = {
  owner: "所有者",
  admin: "管理员",
  editor: "编辑者",
  viewer: "查看者",
}

export const ALLOWED_LIBRARY_FILE_EXTS = ["txt", "md", "pdf", "docx"] as const

const ALLOWED_EXT_SET = new Set<string>(ALLOWED_LIBRARY_FILE_EXTS)

export function isAllowedLibraryFileName(filename: string): boolean {
  const dot = filename.lastIndexOf(".")
  if (dot < 0) return false
  return ALLOWED_EXT_SET.has(filename.slice(dot + 1).toLowerCase())
}

export function canEditLibrarySources(role: LibraryRole): boolean {
  return role === "owner" || role === "admin" || role === "editor"
}

export function canManageLibraryMembers(role: LibraryRole): boolean {
  return role === "owner" || role === "admin"
}

export async function fetchLibraries(
  userId: string
): Promise<LibrarySummary[]> {
  return apiRequestJson<LibrarySummary[]>({
    path: "/libraries",
    userId,
  })
}

export async function fetchLibrary(
  libraryId: string,
  userId: string
): Promise<LibrarySummary> {
  return apiRequestJson<LibrarySummary>({
    path: `/libraries/${libraryId}`,
    userId,
  })
}

export async function createLibrary(
  userId: string,
  name: string
): Promise<LibrarySummary> {
  return apiRequestJson<LibrarySummary>({
    path: "/libraries",
    method: "POST",
    userId,
    json: { name },
  })
}

/** Nest 的 void 路由没有 JSON 体，不能走 apiRequestJson。 */
async function apiRequestOk(
  options: Parameters<typeof apiRequest>[0],
  fallback: string
): Promise<void> {
  const response = await apiRequest(options)
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallback))
  }
}

export async function renameLibrary(
  libraryId: string,
  userId: string,
  name: string
): Promise<void> {
  await apiRequestOk(
    {
      path: `/libraries/${libraryId}`,
      method: "PATCH",
      userId,
      json: { name },
    },
    "重命名失败"
  )
}

export async function deleteLibrary(
  libraryId: string,
  userId: string
): Promise<void> {
  await apiRequestOk(
    {
      path: `/libraries/${libraryId}`,
      method: "DELETE",
      userId,
    },
    "删除资料库失败"
  )
}

export async function updateLibraryEmbedding(
  libraryId: string,
  userId: string,
  patch: EmbeddingPatch
): Promise<EmbeddingPublicView> {
  return apiRequestJson<EmbeddingPublicView>({
    path: `/libraries/${libraryId}/embedding`,
    method: "PUT",
    userId,
    json: patch,
  })
}

export async function fetchLibraryMembers(
  libraryId: string,
  userId: string
): Promise<LibraryMember[]> {
  return apiRequestJson<LibraryMember[]>({
    path: `/libraries/${libraryId}/members`,
    userId,
  })
}

export async function inviteLibraryMember(
  libraryId: string,
  userId: string,
  input: { email: string; role: Exclude<LibraryRole, "owner"> }
): Promise<void> {
  await apiRequestOk(
    {
      path: `/libraries/${libraryId}/members`,
      method: "POST",
      userId,
      json: input,
    },
    "邀请失败"
  )
}

export async function updateLibraryMemberRole(
  libraryId: string,
  userId: string,
  memberUserId: string,
  role: Exclude<LibraryRole, "owner">
): Promise<void> {
  await apiRequestOk(
    {
      path: `/libraries/${libraryId}/members/${memberUserId}`,
      method: "PATCH",
      userId,
      json: { role },
    },
    "更新角色失败"
  )
}

export async function removeLibraryMember(
  libraryId: string,
  userId: string,
  memberUserId: string
): Promise<void> {
  await apiRequestOk(
    {
      path: `/libraries/${libraryId}/members/${memberUserId}`,
      method: "DELETE",
      userId,
    },
    "移除成员失败"
  )
}

export async function fetchLibrarySources(
  libraryId: string,
  userId: string
): Promise<LibrarySource[]> {
  return apiRequestJson<LibrarySource[]>({
    path: `/libraries/${libraryId}/sources`,
    userId,
  })
}

export async function uploadLibrarySourceFile(
  libraryId: string,
  userId: string,
  file: File
): Promise<{ id: string }> {
  const body = new FormData()
  body.set("file", file)
  return apiRequestJson<{ id: string }>({
    path: `/libraries/${libraryId}/sources/file`,
    method: "POST",
    userId,
    body,
  })
}

export type ReadableDocumentHit = {
  id: string
  title: string
}

export async function searchReadableDocuments(
  query: string,
  userId: string
): Promise<ReadableDocumentHit[]> {
  return apiRequestJson<ReadableDocumentHit[]>({
    path: `/documents/search?q=${encodeURIComponent(query)}`,
    userId,
  })
}

export async function importLibraryDocument(
  libraryId: string,
  userId: string,
  documentId: string
): Promise<{ id: string }> {
  return apiRequestJson<{ id: string }>({
    path: `/libraries/${libraryId}/sources/document`,
    method: "POST",
    userId,
    json: { documentId },
  })
}

export async function reindexLibrarySource(
  libraryId: string,
  userId: string,
  sourceId: string
): Promise<void> {
  await apiRequestOk(
    {
      path: `/libraries/${libraryId}/sources/${sourceId}/reindex`,
      method: "POST",
      userId,
    },
    "重新索引失败"
  )
}

export async function deleteLibrarySource(
  libraryId: string,
  userId: string,
  sourceId: string
): Promise<void> {
  await apiRequestOk(
    {
      path: `/libraries/${libraryId}/sources/${sourceId}`,
      method: "DELETE",
      userId,
    },
    "删除来源失败"
  )
}

export async function* askLibraryQuestion(
  libraryId: string,
  userId: string,
  messages: { role: "user" | "assistant"; content: string }[]
): AsyncGenerator<LibraryQaEvent> {
  const response = await apiRequest({
    path: `/libraries/${libraryId}/qa`,
    method: "POST",
    userId,
    json: { messages },
  })
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "问答失败"))
  }
  yield* readLibraryQaSse(response)
}

/** 与 AI 助手相同：按空行分帧，取 data: 行 JSON。 */
async function* readLibraryQaSse(
  response: Response
): AsyncGenerator<LibraryQaEvent> {
  if (!response.body) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const next = await reader.read()
    if (next.done) break
    buffer += decoder.decode(next.value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data: "))
      if (!dataLine) continue
      try {
        const payload = JSON.parse(dataLine.slice(6)) as LibraryQaEvent
        if (
          payload.type === "citations" ||
          payload.type === "token" ||
          payload.type === "done" ||
          payload.type === "error"
        ) {
          yield payload
        }
      } catch {
        // 忽略无法解析的 SSE 帧
      }
    }
  }
}

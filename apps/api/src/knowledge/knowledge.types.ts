/** 嵌入与分块上限：后续入库、截断都复用同一组常量，避免各处各写一遍。 */
export const EMBEDDING_DIMENSIONS = 1536
export const DEFAULT_EMBEDDING_BASE_URL = "https://api.openai.com/v1"
export const CHUNK_TARGET_CHARS = 800
export const CHUNK_OVERLAP_CHARS = 120
export const CHUNK_MAX_COUNT = 400
export const BODY_TEXT_MAX_CHARS = 270_000
export const MAX_KNOWLEDGE_FILE_BYTES = 20 * 1024 * 1024

export type KnowledgeChunkDraft = {
  ordinal: number
  content: string
  heading: string | null
  page: number | null
}

export type KnowledgeChunkErrorCode = "empty" | "too_long" | "too_many_chunks"

export class KnowledgeChunkError extends Error {
  readonly code: KnowledgeChunkErrorCode

  constructor(code: KnowledgeChunkErrorCode) {
    super(code)
    this.name = "KnowledgeChunkError"
    this.code = code
  }
}

export type LibraryRole = "owner" | "admin" | "editor" | "viewer"
export type SourceStatus = "queued" | "processing" | "ready" | "failed"
export type EmbeddingSettings = {
  openAiApiKey?: string
  openAiBaseUrl?: string
  openAiEmbeddingModel?: string
}

/** owner > admin > editor > viewer，数字越大权限越高。 */
const LIBRARY_ROLE_RANK: Record<LibraryRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
}

export function roleAtLeast(role: LibraryRole, minimum: LibraryRole): boolean {
  return LIBRARY_ROLE_RANK[role] >= LIBRARY_ROLE_RANK[minimum]
}

export function sourceStatusLabel(
  status: SourceStatus,
  activeGeneration: number
): "索引中" | "更新中" | "就绪" | "索引失败" | "更新失败，仍可问答" {
  // generation 0 是首次入库；大于 0 表示已有可问答的旧索引。
  const isUpdate = activeGeneration > 0

  if (status === "ready") {
    return "就绪"
  }

  if (status === "failed") {
    return isUpdate ? "更新失败，仍可问答" : "索引失败"
  }

  return isUpdate ? "更新中" : "索引中"
}

export function applyEmbeddingPatch(
  current: { settings: EmbeddingSettings; revision: number },
  patch: EmbeddingSettings
): { settings: EmbeddingSettings; revision: number; modelChanged: boolean } {
  const settings: EmbeddingSettings = {
    ...current.settings,
    ...patch,
  }

  // 空 Key 表示“不改密钥”，避免前端清空输入框把已保存的 Key 冲掉。
  if (patch.openAiApiKey === "") {
    settings.openAiApiKey = current.settings.openAiApiKey
  }

  const currentBase =
    current.settings.openAiBaseUrl ?? DEFAULT_EMBEDDING_BASE_URL
  const nextBase = settings.openAiBaseUrl ?? DEFAULT_EMBEDDING_BASE_URL
  const modelChanged =
    current.settings.openAiEmbeddingModel !== settings.openAiEmbeddingModel ||
    currentBase !== nextBase

  return {
    settings,
    revision: modelChanged ? current.revision + 1 : current.revision,
    modelChanged,
  }
}

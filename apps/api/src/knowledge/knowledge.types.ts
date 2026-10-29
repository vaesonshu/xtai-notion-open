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

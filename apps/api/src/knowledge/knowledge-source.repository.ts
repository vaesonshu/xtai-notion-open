import { Inject, Injectable } from "@nestjs/common"
import { PrismaService } from "../database/prisma.module"
import { type EmbeddingSettings, type SourceStatus } from "./knowledge.types"

export type KnowledgeSourceKind = "file" | "document_snapshot"

export type KnowledgeSourceRecord = {
  id: string
  libraryId: string
  kind: KnowledgeSourceKind
  title: string
  status: SourceStatus
  errorMessage: string | null
  activeGeneration: number
  indexedContentHash?: string | null
  bodyText: string | null
  sourceDocumentId: string | null
  storageKey: string | null
  mimeType?: string | null
  byteSize?: number | null
  lockedAt?: Date | null
  createdBy?: string | null
  updatedAt?: Date
}

export type KnowledgeChunkInsert = {
  sourceId: string
  libraryId: string
  generation: number
  ordinal: number
  content: string
  heading: string | null
  page: number | null
  embedding: number[]
  embeddingRevision: number
}

export type KnowledgeLibraryEmbedding = {
  revision: number
  settings: EmbeddingSettings
}

export type KnowledgeGenerationCommit = {
  sourceId: string
  generation: number
  contentHash: string
  chunks: KnowledgeChunkInsert[]
}

/** Service 只依赖这组方法，测试用内存实现替换，不把 Prisma 传进 service。 */
export type KnowledgeSourceStore = {
  insert(row: KnowledgeSourceRecord): Promise<KnowledgeSourceRecord>
  listByLibrary(libraryId: string): Promise<KnowledgeSourceRecord[]>
  findById(
    libraryId: string,
    sourceId: string
  ): Promise<KnowledgeSourceRecord | null>
  findSnapshot(
    libraryId: string,
    documentId: string
  ): Promise<KnowledgeSourceRecord | null>
  updateBodyAndQueue(sourceId: string, bodyText: string | null): Promise<void>
  deleteById(libraryId: string, sourceId: string): Promise<void>
}

/** Worker 领取、换代、失败；内存假实现用 status 模拟行锁。 */
export type KnowledgeIngestStore = {
  claimNext(): Promise<KnowledgeSourceRecord | null>
  reclaimStale(olderThan: Date): Promise<number>
  commitGeneration(input: KnowledgeGenerationCommit): Promise<void>
  failSource(id: string, message: string): Promise<void>
  saveBodyText(id: string, bodyText: string): Promise<void>
  markReady(id: string): Promise<void>
  findLibraryEmbedding(
    libraryId: string
  ): Promise<KnowledgeLibraryEmbedding | null>
  findActiveEmbeddingRevision(
    sourceId: string,
    generation: number
  ): Promise<number | null>
}

export const CLAIM_NEXT_SQL = `UPDATE knowledge_source
SET status = 'processing', locked_at = now()
WHERE id = (
  SELECT id FROM knowledge_source
  WHERE status = 'queued'
  ORDER BY updated_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *`

const SOURCE_STATUSES = new Set<SourceStatus>([
  "queued",
  "processing",
  "ready",
  "failed",
])

function asSourceKind(kind: string): KnowledgeSourceKind {
  return kind === "document_snapshot" ? "document_snapshot" : "file"
}

function asSourceStatus(status: string): SourceStatus {
  return SOURCE_STATUSES.has(status as SourceStatus)
    ? (status as SourceStatus)
    : "queued"
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) {
      return row[key]
    }
  }
  return undefined
}

function asEmbeddingSettings(value: unknown): EmbeddingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  const raw = value as Record<string, unknown>
  const settings: EmbeddingSettings = {}
  if (typeof raw.openAiApiKey === "string") {
    settings.openAiApiKey = raw.openAiApiKey
  }
  if (typeof raw.openAiBaseUrl === "string") {
    settings.openAiBaseUrl = raw.openAiBaseUrl
  }
  if (typeof raw.openAiEmbeddingModel === "string") {
    settings.openAiEmbeddingModel = raw.openAiEmbeddingModel
  }
  return settings
}

function toRecord(row: {
  id: string
  libraryId: string
  kind: string
  title: string
  status: string
  errorMessage: string | null
  activeGeneration: number
  indexedContentHash?: string | null
  bodyText: string | null
  sourceDocumentId: string | null
  storageKey: string | null
  mimeType: string | null
  byteSize: number | null
  lockedAt?: Date | null
  createdBy: string | null
  updatedAt?: Date
}): KnowledgeSourceRecord {
  return {
    id: row.id,
    libraryId: row.libraryId,
    kind: asSourceKind(row.kind),
    title: row.title,
    status: asSourceStatus(row.status),
    errorMessage: row.errorMessage,
    activeGeneration: row.activeGeneration,
    indexedContentHash: row.indexedContentHash ?? null,
    bodyText: row.bodyText,
    sourceDocumentId: row.sourceDocumentId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    lockedAt: row.lockedAt ?? null,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
  }
}

function toRecordFromClaim(
  row: Record<string, unknown>
): KnowledgeSourceRecord {
  return toRecord({
    id: String(pick(row, "id") ?? ""),
    libraryId: String(pick(row, "libraryId", "library_id") ?? ""),
    kind: String(pick(row, "kind") ?? "file"),
    title: String(pick(row, "title") ?? ""),
    status: String(pick(row, "status") ?? "queued"),
    errorMessage:
      (pick(row, "errorMessage", "error_message") as string | null) ?? null,
    activeGeneration: Number(
      pick(row, "activeGeneration", "active_generation") ?? 0
    ),
    indexedContentHash:
      (pick(row, "indexedContentHash", "indexed_content_hash") as
        | string
        | null) ?? null,
    bodyText: (pick(row, "bodyText", "body_text") as string | null) ?? null,
    sourceDocumentId:
      (pick(row, "sourceDocumentId", "source_document_id") as string | null) ??
      null,
    storageKey:
      (pick(row, "storageKey", "storage_key") as string | null) ?? null,
    mimeType: (pick(row, "mimeType", "mime_type") as string | null) ?? null,
    byteSize: (pick(row, "byteSize", "byte_size") as number | null) ?? null,
    lockedAt: asDate(pick(row, "lockedAt", "locked_at")),
    createdBy: (pick(row, "createdBy", "created_by") as string | null) ?? null,
    updatedAt: asDate(pick(row, "updatedAt", "updated_at")) ?? undefined,
  })
}

@Injectable()
export class KnowledgeSourceRepository
  implements KnowledgeSourceStore, KnowledgeIngestStore
{
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async insert(row: KnowledgeSourceRecord): Promise<KnowledgeSourceRecord> {
    const created = await this.prisma.client.knowledgeSource.create({
      data: {
        id: row.id,
        libraryId: row.libraryId,
        kind: row.kind,
        title: row.title,
        status: row.status,
        errorMessage: row.errorMessage,
        activeGeneration: row.activeGeneration,
        indexedContentHash: row.indexedContentHash ?? null,
        bodyText: row.bodyText,
        sourceDocumentId: row.sourceDocumentId,
        storageKey: row.storageKey,
        mimeType: row.mimeType ?? null,
        byteSize: row.byteSize ?? null,
        lockedAt: row.lockedAt ?? null,
        createdBy: row.createdBy ?? null,
        updatedAt: new Date(),
      },
    })
    return toRecord(created)
  }

  async listByLibrary(libraryId: string): Promise<KnowledgeSourceRecord[]> {
    const rows = await this.prisma.client.knowledgeSource.findMany({
      where: { libraryId },
      orderBy: { createdAt: "asc" },
    })
    return rows.map(toRecord)
  }

  async findById(
    libraryId: string,
    sourceId: string
  ): Promise<KnowledgeSourceRecord | null> {
    const row = await this.prisma.client.knowledgeSource.findFirst({
      where: { id: sourceId, libraryId },
    })
    return row ? toRecord(row) : null
  }

  async findSnapshot(
    libraryId: string,
    documentId: string
  ): Promise<KnowledgeSourceRecord | null> {
    const row = await this.prisma.client.knowledgeSource.findFirst({
      where: {
        libraryId,
        sourceDocumentId: documentId,
        kind: "document_snapshot",
      },
    })
    return row ? toRecord(row) : null
  }

  async updateBodyAndQueue(
    sourceId: string,
    bodyText: string | null
  ): Promise<void> {
    await this.prisma.client.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        bodyText,
        status: "queued",
        updatedAt: new Date(),
      },
    })
  }

  async deleteById(libraryId: string, sourceId: string): Promise<void> {
    // 只删数据库行；COS 对象由控制器在 Task 11 先清。
    await this.prisma.client.knowledgeSource.deleteMany({
      where: { id: sourceId, libraryId },
    })
  }

  async claimNext(): Promise<KnowledgeSourceRecord | null> {
    const rows =
      await this.prisma.client.$queryRawUnsafe<Record<string, unknown>[]>(
        CLAIM_NEXT_SQL
      )
    const row = rows[0]
    return row ? toRecordFromClaim(row) : null
  }

  async reclaimStale(olderThan: Date): Promise<number> {
    // 超时只改回 queued，不清空 body_text，避免 worker 再下一遍对象存储。
    const result = await this.prisma.client.knowledgeSource.updateMany({
      where: {
        status: "processing",
        lockedAt: { lt: olderThan },
      },
      data: {
        status: "queued",
        lockedAt: null,
        updatedAt: new Date(),
      },
    })
    return result.count
  }

  async commitGeneration(input: KnowledgeGenerationCommit): Promise<void> {
    // 换代和删除旧分块必须同一事务：崩溃时不能留下半套可被问答读到的向量。
    await this.prisma.client.$transaction(async (tx) => {
      for (const chunk of input.chunks) {
        const vectorLiteral = `[${chunk.embedding.join(",")}]`
        await tx.$executeRaw`
          INSERT INTO knowledge_chunk (
            library_id, source_id, generation, ordinal, content,
            heading, page, embedding, embedding_revision
          )
          VALUES (
            ${chunk.libraryId}::uuid,
            ${chunk.sourceId}::uuid,
            ${chunk.generation},
            ${chunk.ordinal},
            ${chunk.content},
            ${chunk.heading},
            ${chunk.page},
            ${vectorLiteral}::vector,
            ${chunk.embeddingRevision}
          )
        `
      }
      await tx.knowledgeSource.update({
        where: { id: input.sourceId },
        data: {
          activeGeneration: input.generation,
          indexedContentHash: input.contentHash,
          status: "ready",
          errorMessage: null,
          lockedAt: null,
          updatedAt: new Date(),
        },
      })
      await tx.knowledgeChunk.deleteMany({
        where: {
          sourceId: input.sourceId,
          generation: { not: input.generation },
        },
      })
    })
  }

  async failSource(id: string, message: string): Promise<void> {
    await this.prisma.client.knowledgeSource.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: message,
        lockedAt: null,
        updatedAt: new Date(),
      },
    })
  }

  async saveBodyText(id: string, bodyText: string): Promise<void> {
    await this.prisma.client.knowledgeSource.update({
      where: { id },
      data: { bodyText, updatedAt: new Date() },
    })
  }

  async markReady(id: string): Promise<void> {
    await this.prisma.client.knowledgeSource.update({
      where: { id },
      data: {
        status: "ready",
        errorMessage: null,
        lockedAt: null,
        updatedAt: new Date(),
      },
    })
  }

  async findLibraryEmbedding(
    libraryId: string
  ): Promise<KnowledgeLibraryEmbedding | null> {
    const library = await this.prisma.client.knowledgeLibrary.findUnique({
      where: { id: libraryId },
      select: {
        embeddingRevision: true,
        embeddingSettings: true,
      },
    })
    if (!library) {
      return null
    }
    return {
      revision: library.embeddingRevision,
      settings: asEmbeddingSettings(library.embeddingSettings),
    }
  }

  async findActiveEmbeddingRevision(
    sourceId: string,
    generation: number
  ): Promise<number | null> {
    const chunk = await this.prisma.client.knowledgeChunk.findFirst({
      where: { sourceId, generation },
      select: { embeddingRevision: true },
    })
    return chunk?.embeddingRevision ?? null
  }
}

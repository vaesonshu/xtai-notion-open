import { Inject, Injectable } from "@nestjs/common"
import { PrismaService } from "../database/prisma.module"
import { type KnowledgeHitRow } from "./knowledge-retrieval"
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
  updateBodyAndQueue(
    sourceId: string,
    bodyText: string | null,
    title?: string
  ): Promise<void>
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

export type KnowledgeNearestQuery = {
  libraryId: string
  embeddingRevision: number
  embedding: number[]
}

/** 问答检索只依赖这组方法，距离阈值仍由 selectKnowledgeHits 过滤。 */
export type KnowledgeRetrievalStore = {
  findNearestChunks(input: KnowledgeNearestQuery): Promise<KnowledgeHitRow[]>
  countPendingSources(
    libraryId: string,
    embeddingRevision: number
  ): Promise<number>
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

// 距离过滤留在 selectKnowledgeHits，这里只按库、当前代和版本取最近 6 条。
export const FIND_NEAREST_CHUNKS_SQL = `SELECT
  chunk.library_id,
  chunk.source_id,
  source.title AS source_title,
  chunk.generation,
  source.active_generation,
  chunk.embedding_revision,
  chunk.content,
  chunk.heading,
  chunk.page,
  (embedding <=> $3::vector) AS distance
FROM knowledge_chunk AS chunk
INNER JOIN knowledge_source AS source ON source.id = chunk.source_id
WHERE chunk.library_id = $1
  AND generation = active_generation
  AND active_generation > 0
  AND embedding_revision = $2
ORDER BY embedding <=> $3
LIMIT 6`

const COUNT_PENDING_SOURCES_SQL = `SELECT COUNT(*)::int AS count
FROM knowledge_source AS source
WHERE source.library_id = $1
AND NOT EXISTS (
  SELECT 1
  FROM knowledge_chunk AS chunk
  WHERE chunk.source_id = source.id
    AND chunk.generation = source.active_generation
    AND source.active_generation > 0
    AND chunk.embedding_revision = $2
)`

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

function toHitRow(
  row: Record<string, unknown>,
  libraryRevision: number
): KnowledgeHitRow {
  const page = pick(row, "page")
  return {
    distance: Number(pick(row, "distance") ?? 0),
    libraryId: String(pick(row, "libraryId", "library_id") ?? ""),
    generation: Number(pick(row, "generation") ?? 0),
    activeGeneration: Number(
      pick(row, "activeGeneration", "active_generation") ?? 0
    ),
    embeddingRevision: Number(
      pick(row, "embeddingRevision", "embedding_revision") ?? 0
    ),
    libraryRevision,
    content: String(pick(row, "content") ?? ""),
    sourceId: String(pick(row, "sourceId", "source_id") ?? ""),
    sourceTitle: String(pick(row, "sourceTitle", "source_title") ?? ""),
    heading: (pick(row, "heading") as string | null) ?? null,
    page: page == null ? null : Number(page),
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
  implements KnowledgeSourceStore, KnowledgeIngestStore, KnowledgeRetrievalStore
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
    bodyText: string | null,
    title?: string
  ): Promise<void> {
    await this.prisma.client.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        bodyText,
        status: "queued",
        updatedAt: new Date(),
        // 文件重索引不传 title，避免把文件名冲掉。
        ...(title === undefined ? {} : { title }),
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
      const source = await tx.knowledgeSource.findUnique({
        where: { id: input.sourceId },
        select: { libraryId: true },
      })
      if (!source) {
        return
      }
      const library = await tx.knowledgeLibrary.findUnique({
        where: { id: source.libraryId },
        select: { embeddingRevision: true },
      })
      const commitRevision = input.chunks[0]?.embeddingRevision
      // 库已换模型：旧向量不能成为可检索代，来源回到排队并保留上一成功代。
      if (
        library == null ||
        commitRevision === undefined ||
        library.embeddingRevision !== commitRevision
      ) {
        await tx.knowledgeSource.update({
          where: { id: input.sourceId },
          data: {
            status: "queued",
            lockedAt: null,
            updatedAt: new Date(),
          },
        })
        return
      }
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
    await this.prisma.client.$transaction(async (tx) => {
      const source = await tx.knowledgeSource.findUnique({
        where: { id },
        select: { libraryId: true, activeGeneration: true },
      })
      if (!source) {
        return
      }
      const library = await tx.knowledgeLibrary.findUnique({
        where: { id: source.libraryId },
        select: { embeddingRevision: true },
      })
      const chunk = await tx.knowledgeChunk.findFirst({
        where: {
          sourceId: id,
          generation: source.activeGeneration,
        },
        select: { embeddingRevision: true },
      })
      // 跳过嵌入的 ready 路径同样不能把过期向量标成可检索。
      if (
        library == null ||
        chunk == null ||
        library.embeddingRevision !== chunk.embeddingRevision
      ) {
        await tx.knowledgeSource.update({
          where: { id },
          data: {
            status: "queued",
            lockedAt: null,
            updatedAt: new Date(),
          },
        })
        return
      }
      await tx.knowledgeSource.update({
        where: { id },
        data: {
          status: "ready",
          errorMessage: null,
          lockedAt: null,
          updatedAt: new Date(),
        },
      })
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

  async findNearestChunks(
    input: KnowledgeNearestQuery
  ): Promise<KnowledgeHitRow[]> {
    const vectorLiteral = `[${input.embedding.join(",")}]`
    const rows = await this.prisma.client.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      FIND_NEAREST_CHUNKS_SQL,
      input.libraryId,
      input.embeddingRevision,
      vectorLiteral
    )
    return rows.map((row) => toHitRow(row, input.embeddingRevision))
  }

  async countPendingSources(
    libraryId: string,
    embeddingRevision: number
  ): Promise<number> {
    const rows = await this.prisma.client.$queryRawUnsafe<
      Array<{ count: number | bigint }>
    >(COUNT_PENDING_SOURCES_SQL, libraryId, embeddingRevision)
    return Number(rows[0]?.count ?? 0)
  }
}

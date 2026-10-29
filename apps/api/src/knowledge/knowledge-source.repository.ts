import { Inject, Injectable } from "@nestjs/common"
import { PrismaService } from "../database/prisma.module"
import { type SourceStatus } from "./knowledge.types"

export type KnowledgeSourceKind = "file" | "document_snapshot"

export type KnowledgeSourceRecord = {
  id: string
  libraryId: string
  kind: KnowledgeSourceKind
  title: string
  status: SourceStatus
  errorMessage: string | null
  activeGeneration: number
  bodyText: string | null
  sourceDocumentId: string | null
  storageKey: string | null
  mimeType?: string | null
  byteSize?: number | null
  createdBy?: string | null
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

function toRecord(row: {
  id: string
  libraryId: string
  kind: string
  title: string
  status: string
  errorMessage: string | null
  activeGeneration: number
  bodyText: string | null
  sourceDocumentId: string | null
  storageKey: string | null
  mimeType: string | null
  byteSize: number | null
  createdBy: string | null
}): KnowledgeSourceRecord {
  return {
    id: row.id,
    libraryId: row.libraryId,
    kind: asSourceKind(row.kind),
    title: row.title,
    status: asSourceStatus(row.status),
    errorMessage: row.errorMessage,
    activeGeneration: row.activeGeneration,
    bodyText: row.bodyText,
    sourceDocumentId: row.sourceDocumentId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    createdBy: row.createdBy,
  }
}

@Injectable()
export class KnowledgeSourceRepository implements KnowledgeSourceStore {
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
        bodyText: row.bodyText,
        sourceDocumentId: row.sourceDocumentId,
        storageKey: row.storageKey,
        mimeType: row.mimeType ?? null,
        byteSize: row.byteSize ?? null,
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
}

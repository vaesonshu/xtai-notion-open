import { Inject, Injectable, Logger, Optional } from "@nestjs/common"
import {
  CURRENT_SCHEMA_VERSION,
  migrateV1YDocToV2,
  readYDocSchemaVersion,
} from "@xtai-notion/editor-core/server"
import * as Y from "yjs"
import { DocumentsRepository } from "../documents/documents.repository"
import { YjsPersistenceRepository } from "./yjs-persistence.repository"

export type YjsPersistenceOptions = {
  flushDelayMs?: number
  compactUpdateCountThreshold?: number
}

export const YJS_PERSISTENCE_OPTIONS = Symbol("YJS_PERSISTENCE_OPTIONS")

type DocumentBuffer = {
  updates: Uint8Array[]
  timer: ReturnType<typeof setTimeout> | null
}

const DEFAULT_FLUSH_DELAY_MS = 250
const DEFAULT_COMPACT_UPDATE_COUNT_THRESHOLD = 50

/** document 已删除时的 FK 违反：重试无意义，应丢弃缓冲避免死循环 flush */
function isDocumentMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2003"
  )
}

@Injectable()
export class YjsPersistenceService {
  private readonly logger = new Logger(YjsPersistenceService.name)
  private readonly flushDelayMs: number
  private readonly compactUpdateCountThreshold: number
  private readonly buffers = new Map<string, DocumentBuffer>()
  // 同一文档的 flush 串行化，避免并发事务在 pg_advisory_xact_lock 上等待超时
  private readonly flushChains = new Map<string, Promise<void>>()
  // 同一文档的 onLoad 迁移串行化，避免并发协作会话重复迁移
  private readonly migrateChains = new Map<string, Promise<Y.Doc>>()

  constructor(
    @Inject(YjsPersistenceRepository)
    private readonly repository: YjsPersistenceRepository,
    @Optional()
    @Inject(YJS_PERSISTENCE_OPTIONS)
    options: YjsPersistenceOptions | null = null,
    @Optional()
    @Inject(DocumentsRepository)
    private readonly documents: DocumentsRepository | null = null
  ) {
    this.flushDelayMs = options?.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS
    this.compactUpdateCountThreshold =
      options?.compactUpdateCountThreshold ??
      DEFAULT_COMPACT_UPDATE_COUNT_THRESHOLD
  }

  async loadDocument(documentId: string): Promise<Y.Doc> {
    const previous = this.migrateChains.get(documentId) ?? Promise.resolve(null)
    const current = previous
      .catch(() => null)
      .then(() => this.loadDocumentOnce(documentId))
    this.migrateChains.set(documentId, current)

    try {
      return await current
    } finally {
      if (this.migrateChains.get(documentId) === current) {
        this.migrateChains.delete(documentId)
      }
    }
  }

  private async loadDocumentOnce(documentId: string): Promise<Y.Doc> {
    const doc = new Y.Doc()
    const snapshot = await this.repository.getLatestSnapshot(documentId)
    if (snapshot) {
      Y.applyUpdate(doc, new Uint8Array(snapshot.snapshot))
    }

    const afterSequence = snapshot?.sequence ?? 0
    const updates = await this.repository.listUpdatesAfter(
      documentId,
      afterSequence
    )
    for (const row of updates) {
      Y.applyUpdate(doc, new Uint8Array(row.update))
    }

    // 单元测试可不注入 DocumentsRepository，此时跳过 onLoad 迁移逻辑
    if (!this.documents) {
      return doc
    }

    const dbSchemaVersion = await this.documents.getSchemaVersion(documentId)
    const yDocSchemaVersion = readYDocSchemaVersion(doc)

    // Y.Doc 已是块 schema v2：只同步 DB 列，避免用 v1 解析器误迁移导致内容丢失
    if (yDocSchemaVersion >= CURRENT_SCHEMA_VERSION) {
      if (dbSchemaVersion < CURRENT_SCHEMA_VERSION) {
        await this.documents.updateSchemaVersion(
          documentId,
          CURRENT_SCHEMA_VERSION
        )
      }
      return doc
    }

    try {
      const migratedDoc = migrateV1YDocToV2(doc)
      doc.destroy()

      const maxSequence = await this.repository.getMaxSequence(documentId)
      if (maxSequence > 0) {
        const migratedSnapshot = Y.encodeStateAsUpdate(migratedDoc)
        await this.repository.insertSnapshot(
          documentId,
          migratedSnapshot,
          maxSequence
        )
        await this.repository.deleteUpdatesUpTo(documentId, maxSequence)
      }

      await this.documents.updateSchemaVersion(
        documentId,
        CURRENT_SCHEMA_VERSION
      )

      return migratedDoc
    } catch (error) {
      this.logger.error(
        `Failed to migrate Yjs document ${documentId} to schema v${CURRENT_SCHEMA_VERSION}`,
        error instanceof Error ? error.stack : String(error)
      )
      // 迁移失败：保留 v1 快照与 DB schema_version，继续返回已加载的 doc
      return doc
    }
  }

  enqueueUpdate(documentId: string, update: Uint8Array): void {
    const buffer = this.getOrCreateBuffer(documentId)
    buffer.updates.push(update)
    this.scheduleFlush(documentId, buffer)
  }

  async flushDocument(documentId: string): Promise<void> {
    const previous = this.flushChains.get(documentId) ?? Promise.resolve()
    const current = previous
      .catch(() => undefined)
      .then(() => this.flushDocumentOnce(documentId))
    this.flushChains.set(documentId, current)

    try {
      await current
    } finally {
      if (this.flushChains.get(documentId) === current) {
        this.flushChains.delete(documentId)
      }
    }
  }

  private async flushDocumentOnce(documentId: string): Promise<void> {
    const buffer = this.buffers.get(documentId)
    if (!buffer || buffer.updates.length === 0) {
      this.clearTimer(buffer)
      this.buffers.delete(documentId)
      return
    }

    this.clearTimer(buffer)
    const updates = buffer.updates.splice(0, buffer.updates.length)
    this.buffers.delete(documentId)

    try {
      await this.repository.insertUpdates(documentId, updates)
    } catch (error) {
      if (isDocumentMissingError(error)) {
        this.logger.warn(
          `Discarding ${updates.length} Yjs update(s) for missing document ${documentId}`
        )
        return
      }
      // 写入失败时把 updates 合并回缓冲区，避免协作内容丢失
      const failedBuffer = this.getOrCreateBuffer(documentId)
      failedBuffer.updates.unshift(...updates)
      this.scheduleFlush(documentId, failedBuffer)
      throw error
    }

    const snapshot = await this.repository.getLatestSnapshot(documentId)
    const afterSequence = snapshot?.sequence ?? 0
    const pendingCount = await this.repository.countUpdatesAfterSequence(
      documentId,
      afterSequence
    )
    if (pendingCount >= this.compactUpdateCountThreshold) {
      await this.compactDocument(documentId)
    }
  }

  async compactDocument(documentId: string): Promise<void> {
    const doc = await this.loadDocument(documentId)
    const maxSequence = await this.repository.getMaxSequence(documentId)
    if (maxSequence <= 0) {
      doc.destroy()
      return
    }

    const snapshot = Y.encodeStateAsUpdate(doc)
    doc.destroy()

    await this.repository.insertSnapshot(documentId, snapshot, maxSequence)
    await this.repository.deleteUpdatesUpTo(documentId, maxSequence)
  }

  async flushAll(): Promise<void> {
    const documentIds = [...this.buffers.keys()]
    await Promise.all(documentIds.map((id) => this.flushDocument(id)))
  }

  private getOrCreateBuffer(documentId: string): DocumentBuffer {
    const existing = this.buffers.get(documentId)
    if (existing) {
      return existing
    }
    const created: DocumentBuffer = { updates: [], timer: null }
    this.buffers.set(documentId, created)
    return created
  }

  private scheduleFlush(documentId: string, buffer: DocumentBuffer): void {
    this.clearTimer(buffer)
    buffer.timer = setTimeout(() => {
      void this.flushDocument(documentId).catch((error: unknown) => {
        this.logger.error(
          `Failed to flush Yjs updates for document ${documentId}`,
          error instanceof Error ? error.stack : String(error)
        )
      })
    }, this.flushDelayMs)
    if (typeof buffer.timer === "object" && "unref" in buffer.timer) {
      buffer.timer.unref()
    }
  }

  private clearTimer(buffer: DocumentBuffer | undefined): void {
    if (!buffer?.timer) {
      return
    }
    clearTimeout(buffer.timer)
    buffer.timer = null
  }
}

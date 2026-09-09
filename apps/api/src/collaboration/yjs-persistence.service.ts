import { Inject, Injectable, Logger, Optional } from "@nestjs/common"
import {
  CURRENT_SCHEMA_VERSION,
  createBlockSchemaYDoc,
  documentFromYjs,
  documentToPlainText,
  readYDocSchemaVersion,
} from "@xtai-notion/editor-core/server"
import type { Block } from "@xtai-notion/editor-core/server"
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

/** 将 Neon WebSocket 的 ErrorEvent 等非常规错误格式化为可读日志 */
function formatPersistenceError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }
  return String(error)
}

@Injectable()
export class YjsPersistenceService {
  private readonly logger = new Logger(YjsPersistenceService.name)
  private readonly flushDelayMs: number
  private readonly compactUpdateCountThreshold: number
  private readonly buffers = new Map<string, DocumentBuffer>()
  // 同一文档的 flush 串行化，避免并发事务在 pg_advisory_xact_lock 上等待超时
  private readonly flushChains = new Map<string, Promise<void>>()
  // 同一文档的 load 串行化，避免并发协作会话重复读库
  private readonly loadChains = new Map<string, Promise<Y.Doc>>()

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
    const previous = this.loadChains.get(documentId) ?? Promise.resolve(null)
    const current = previous
      .catch(() => null)
      .then(() => this.loadDocumentOnce(documentId))
    this.loadChains.set(documentId, current)

    try {
      return await current
    } finally {
      if (this.loadChains.get(documentId) === current) {
        this.loadChains.delete(documentId)
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

    if (!this.documents) {
      return doc
    }

    const dbSchemaVersion = await this.documents.getSchemaVersion(documentId)
    const yDocSchemaVersion = readYDocSchemaVersion(doc)

    if (yDocSchemaVersion < CURRENT_SCHEMA_VERSION) {
      this.logger.warn(
        `Yjs document ${documentId} uses unsupported schema v${yDocSchemaVersion}; expected v${CURRENT_SCHEMA_VERSION}`
      )
    }

    if (dbSchemaVersion < CURRENT_SCHEMA_VERSION) {
      await this.documents.updateSchemaVersion(
        documentId,
        CURRENT_SCHEMA_VERSION
      )
    }

    return doc
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

  /** solo REST 保存：整篇替换 Yjs 快照，并丢弃未合并的增量更新 */
  async replaceDocumentContent(
    documentId: string,
    blocks: Block[]
  ): Promise<void> {
    await this.flushDocument(documentId)
    const yDoc = createBlockSchemaYDoc(blocks)
    try {
      const snapshot = Y.encodeStateAsUpdate(yDoc)
      await this.repository.deleteAllUpdates(documentId)
      const nextSequence =
        (await this.repository.getMaxSequence(documentId)) + 1
      await this.repository.insertSnapshot(documentId, snapshot, nextSequence)
    } finally {
      yDoc.destroy()
    }
  }

  /** 为新文档写入初始 Block[] 快照（导入 Markdown 等场景） */
  async seedInitialContent(documentId: string, blocks: Block[]): Promise<void> {
    const existing = await this.repository.getLatestSnapshot(documentId)
    if (existing) {
      return
    }
    const yDoc = createBlockSchemaYDoc(blocks)
    const snapshot = Y.encodeStateAsUpdate(yDoc)
    yDoc.destroy()
    await this.repository.insertSnapshot(documentId, snapshot, 1)
  }

  /** 将当前协作文档固化为可回滚的历史版本 */
  async saveVersion(documentId: string): Promise<{
    id: string
    sequence: number
    createdAt: Date
    excerpt: string
  }> {
    await this.flushDocument(documentId)
    const doc = await this.loadDocument(documentId)
    try {
      const content = documentFromYjs(doc)
      const excerpt = documentToPlainText(content).slice(0, 120)
      const snapshot = Y.encodeStateAsUpdate(doc)
      const maxSequence = await this.repository.getMaxSequence(documentId)
      await this.repository.insertSnapshot(documentId, snapshot, maxSequence)
      const versions = await this.repository.listSnapshots(documentId)
      const latest = versions[0]
      if (!latest) {
        throw new Error("Failed to persist document version")
      }
      return {
        id: latest.id.toString(),
        sequence: latest.sequence,
        createdAt: latest.createdAt,
        excerpt,
      }
    } finally {
      doc.destroy()
    }
  }

  /** 列出文档历史版本（基于 Yjs 快照） */
  async listVersions(documentId: string): Promise<
    Array<{
      id: string
      sequence: number
      createdAt: Date
      excerpt: string
    }>
  > {
    const rows = await this.repository.listSnapshots(documentId)
    return rows.map((row) => {
      const yDoc = new Y.Doc()
      Y.applyUpdate(yDoc, new Uint8Array(row.snapshot))
      let excerpt = ""
      try {
        const content = documentFromYjs(yDoc)
        excerpt = documentToPlainText(content).slice(0, 120)
      } catch {
        excerpt = ""
      } finally {
        yDoc.destroy()
      }
      return {
        id: row.id.toString(),
        sequence: row.sequence,
        createdAt: row.createdAt,
        excerpt,
      }
    })
  }

  /** 将文档内容回滚到指定快照，并清空后续增量更新 */
  async restoreVersion(documentId: string, versionId: string): Promise<void> {
    const snapshotId = BigInt(versionId)
    const row = await this.repository.getSnapshotById(snapshotId)
    if (!row || row.documentId !== documentId) {
      throw new Error("Version not found")
    }
    await this.flushDocument(documentId)
    const nextSequence = (await this.repository.getMaxSequence(documentId)) + 1
    await this.repository.deleteAllUpdates(documentId)
    await this.repository.insertSnapshot(
      documentId,
      new Uint8Array(row.snapshot),
      nextSequence
    )
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
          formatPersistenceError(error)
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

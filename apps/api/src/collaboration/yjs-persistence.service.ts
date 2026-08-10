import { Inject, Injectable, Optional } from "@nestjs/common"
import * as Y from "yjs"
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

@Injectable()
export class YjsPersistenceService {
  private readonly flushDelayMs: number
  private readonly compactUpdateCountThreshold: number
  private readonly buffers = new Map<string, DocumentBuffer>()

  constructor(
    @Inject(YjsPersistenceRepository)
    private readonly repository: YjsPersistenceRepository,
    @Optional()
    @Inject(YJS_PERSISTENCE_OPTIONS)
    options: YjsPersistenceOptions | null = null
  ) {
    this.flushDelayMs = options?.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS
    this.compactUpdateCountThreshold =
      options?.compactUpdateCountThreshold ??
      DEFAULT_COMPACT_UPDATE_COUNT_THRESHOLD
  }

  async loadDocument(documentId: string): Promise<Y.Doc> {
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
    return doc
  }

  enqueueUpdate(documentId: string, update: Uint8Array): void {
    const buffer = this.getOrCreateBuffer(documentId)
    buffer.updates.push(update)
    this.scheduleFlush(documentId, buffer)
  }

  async flushDocument(documentId: string): Promise<void> {
    const buffer = this.buffers.get(documentId)
    if (!buffer || buffer.updates.length === 0) {
      this.clearTimer(buffer)
      this.buffers.delete(documentId)
      return
    }

    this.clearTimer(buffer)
    const updates = buffer.updates.splice(0, buffer.updates.length)
    this.buffers.delete(documentId)

    await this.repository.insertUpdates(documentId, updates)

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
      void this.flushDocument(documentId)
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

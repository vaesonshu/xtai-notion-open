import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createBlockSchemaYDoc,
  documentToPlainText,
  documentFromYjs,
} from "@xtai-notion/editor-core/server"
import * as Y from "yjs"
import type { DocumentsRepository } from "../documents/documents.repository"
import type { YjsPersistenceRepository } from "./yjs-persistence.repository"
import { YjsPersistenceService } from "./yjs-persistence.service"

function encodeTextUpdate(text: string): Uint8Array {
  const doc = new Y.Doc()
  doc.getText("content").insert(0, text)
  return Y.encodeStateAsUpdate(doc)
}

function createDocumentsRepo(
  overrides: Partial<DocumentsRepository> = {}
): DocumentsRepository {
  return {
    getSchemaVersion: vi.fn().mockResolvedValue(1),
    updateSchemaVersion: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as DocumentsRepository
}

function createRepo(
  overrides: Partial<YjsPersistenceRepository> = {}
): YjsPersistenceRepository {
  return {
    getLatestSnapshot: vi.fn().mockResolvedValue(null),
    listUpdatesAfter: vi.fn().mockResolvedValue([]),
    insertUpdates: vi.fn().mockResolvedValue({ lastSequence: 0 }),
    insertSnapshot: vi.fn().mockResolvedValue(undefined),
    deleteUpdatesUpTo: vi.fn().mockResolvedValue(undefined),
    countUpdatesAfterSequence: vi.fn().mockResolvedValue(0),
    getMaxSequence: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as YjsPersistenceRepository
}

describe("YjsPersistenceService", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("loadDocument applies latest snapshot then ordered updates", async () => {
    const base = new Y.Doc()
    base.getText("content").insert(0, "Hello")
    const snapshot = Buffer.from(Y.encodeStateAsUpdate(base))

    const next = new Y.Doc()
    Y.applyUpdate(next, snapshot)
    next.getText("content").insert(5, " world")
    const update = Buffer.from(
      Y.encodeStateAsUpdate(next, Y.encodeStateVector(base))
    )

    const repo = createRepo({
      getLatestSnapshot: vi.fn().mockResolvedValue({
        snapshot,
        sequence: 3,
      }),
      listUpdatesAfter: vi.fn().mockResolvedValue([{ update, sequence: 4 }]),
    })
    const service = new YjsPersistenceService(repo)

    const loaded = await service.loadDocument("doc-1")
    expect(loaded.getText("content").toString()).toBe("Hello world")
    expect(repo.getLatestSnapshot).toHaveBeenCalledWith("doc-1")
    expect(repo.listUpdatesAfter).toHaveBeenCalledWith("doc-1", 3)
  })

  it("loadDocument returns empty doc when no snapshot or updates exist", async () => {
    const service = new YjsPersistenceService(createRepo())
    const loaded = await service.loadDocument("doc-empty")
    expect(loaded.getText("content").toString()).toBe("")
  })

  it("enqueueUpdate batches writes into a single transaction via flushDocument", async () => {
    const insertUpdates = vi.fn().mockResolvedValue({ lastSequence: 2 })
    const repo = createRepo({
      insertUpdates,
      countUpdatesAfterSequence: vi.fn().mockResolvedValue(2),
      getMaxSequence: vi.fn().mockResolvedValue(2),
    })
    const service = new YjsPersistenceService(repo, {
      flushDelayMs: 10_000,
      compactUpdateCountThreshold: 100,
    })

    const first = encodeTextUpdate("a")
    const second = encodeTextUpdate("b")
    service.enqueueUpdate("doc-1", first)
    service.enqueueUpdate("doc-1", second)

    expect(insertUpdates).not.toHaveBeenCalled()

    await service.flushDocument("doc-1")

    expect(insertUpdates).toHaveBeenCalledTimes(1)
    expect(insertUpdates).toHaveBeenCalledWith("doc-1", [first, second])
  })

  it("flushDocument discards updates when document row was deleted (FK P2003)", async () => {
    const insertUpdates = vi.fn().mockRejectedValue({ code: "P2003" })
    const repo = createRepo({ insertUpdates })
    const service = new YjsPersistenceService(repo, {
      flushDelayMs: 10_000,
    })

    service.enqueueUpdate("doc-deleted", encodeTextUpdate("orphan"))
    await expect(service.flushDocument("doc-deleted")).resolves.toBeUndefined()
    expect(insertUpdates).toHaveBeenCalledTimes(1)

    insertUpdates.mockClear()
    await service.flushDocument("doc-deleted")
    expect(insertUpdates).not.toHaveBeenCalled()
  })

  it("auto-flushes buffered updates after the flush delay", async () => {
    vi.useFakeTimers()
    const insertUpdates = vi.fn().mockResolvedValue({ lastSequence: 1 })
    const repo = createRepo({
      insertUpdates,
      countUpdatesAfterSequence: vi.fn().mockResolvedValue(1),
      getMaxSequence: vi.fn().mockResolvedValue(1),
    })
    const service = new YjsPersistenceService(repo, {
      flushDelayMs: 50,
      compactUpdateCountThreshold: 100,
    })

    const update = encodeTextUpdate("delayed")
    service.enqueueUpdate("doc-1", update)

    await vi.advanceTimersByTimeAsync(49)
    expect(insertUpdates).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(insertUpdates).toHaveBeenCalledWith("doc-1", [update])
  })

  it("compactDocument stores a snapshot and deletes covered updates", async () => {
    const base = new Y.Doc()
    base.getText("content").insert(0, "snap")
    const snapshotBytes = Buffer.from(Y.encodeStateAsUpdate(base))
    const later = Buffer.from(encodeTextUpdate("ignored-for-load-path"))

    const insertSnapshot = vi.fn().mockResolvedValue(undefined)
    const deleteUpdatesUpTo = vi.fn().mockResolvedValue(undefined)
    const repo = createRepo({
      getLatestSnapshot: vi.fn().mockResolvedValue({
        snapshot: snapshotBytes,
        sequence: 2,
      }),
      listUpdatesAfter: vi.fn().mockResolvedValue([
        { update: later, sequence: 3 },
        { update: later, sequence: 4 },
      ]),
      getMaxSequence: vi.fn().mockResolvedValue(4),
      insertSnapshot,
      deleteUpdatesUpTo,
      countUpdatesAfterSequence: vi.fn().mockResolvedValue(2),
    })
    const service = new YjsPersistenceService(repo, {
      compactUpdateCountThreshold: 2,
    })

    await service.compactDocument("doc-1")

    expect(insertSnapshot).toHaveBeenCalledTimes(1)
    const [, snapshotArg, sequenceArg] = insertSnapshot.mock.calls[0] as [
      string,
      Uint8Array,
      number,
    ]
    expect(sequenceArg).toBe(4)
    expect(snapshotArg).toBeInstanceOf(Uint8Array)
    expect(deleteUpdatesUpTo).toHaveBeenCalledWith("doc-1", 4)
  })

  it("serializes concurrent flushDocument calls for the same document", async () => {
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let activeFlushes = 0
    let maxConcurrentFlushes = 0

    const insertUpdates = vi.fn().mockImplementation(async () => {
      activeFlushes += 1
      maxConcurrentFlushes = Math.max(maxConcurrentFlushes, activeFlushes)
      await firstGate
      activeFlushes -= 1
      return { lastSequence: 1 }
    })
    const repo = createRepo({
      insertUpdates,
      countUpdatesAfterSequence: vi.fn().mockResolvedValue(1),
      getMaxSequence: vi.fn().mockResolvedValue(1),
    })
    const service = new YjsPersistenceService(repo, {
      flushDelayMs: 10_000,
      compactUpdateCountThreshold: 100,
    })

    service.enqueueUpdate("doc-1", encodeTextUpdate("a"))
    void service.flushDocument("doc-1")

    await vi.waitFor(() => {
      expect(insertUpdates).toHaveBeenCalledTimes(1)
    })
    expect(maxConcurrentFlushes).toBe(1)

    service.enqueueUpdate("doc-1", encodeTextUpdate("b"))
    void service.flushDocument("doc-1")

    releaseFirst?.()
    await vi.waitFor(() => {
      expect(insertUpdates).toHaveBeenCalledTimes(2)
    })
    expect(maxConcurrentFlushes).toBe(1)
  })

  it("restores buffered updates when insertUpdates fails", async () => {
    const insertUpdates = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue({ lastSequence: 1 })
    const repo = createRepo({
      insertUpdates,
      countUpdatesAfterSequence: vi.fn().mockResolvedValue(1),
      getMaxSequence: vi.fn().mockResolvedValue(1),
    })
    const service = new YjsPersistenceService(repo, {
      flushDelayMs: 10_000,
      compactUpdateCountThreshold: 100,
    })
    const update = encodeTextUpdate("retry")

    service.enqueueUpdate("doc-1", update)
    await expect(service.flushDocument("doc-1")).rejects.toThrow("db down")

    await service.flushDocument("doc-1")

    expect(insertUpdates).toHaveBeenCalledTimes(2)
    expect(insertUpdates.mock.calls[1]?.[1]).toEqual([update])
  })

  it("flushDocument triggers compact when update count reaches threshold", async () => {
    const insertUpdates = vi.fn().mockResolvedValue({ lastSequence: 5 })
    const compactSpy = vi.fn()
    const repo = createRepo({
      insertUpdates,
      countUpdatesAfterSequence: vi.fn().mockResolvedValue(5),
      getMaxSequence: vi.fn().mockResolvedValue(5),
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      listUpdatesAfter: vi.fn().mockResolvedValue([]),
      insertSnapshot: vi.fn().mockResolvedValue(undefined),
      deleteUpdatesUpTo: vi.fn().mockResolvedValue(undefined),
    })
    const service = new YjsPersistenceService(repo, {
      flushDelayMs: 10_000,
      compactUpdateCountThreshold: 5,
    })
    service.compactDocument = compactSpy

    service.enqueueUpdate("doc-1", encodeTextUpdate("x"))
    await service.flushDocument("doc-1")

    expect(compactSpy).toHaveBeenCalledWith("doc-1")
  })

  it("loadDocument syncs DB schemaVersion when Y.Doc is already v2", async () => {
    const v2Snapshot = Buffer.from(
      Y.encodeStateAsUpdate(createBlockSchemaYDoc())
    )
    const updateSchemaVersion = vi.fn().mockResolvedValue(undefined)
    const repo = createRepo({
      getLatestSnapshot: vi.fn().mockResolvedValue({
        snapshot: v2Snapshot,
        sequence: 1,
      }),
      listUpdatesAfter: vi.fn().mockResolvedValue([]),
    })
    const documents = createDocumentsRepo({
      getSchemaVersion: vi.fn().mockResolvedValue(1),
      updateSchemaVersion,
    })
    const service = new YjsPersistenceService(repo, null, documents)

    const loaded = await service.loadDocument("doc-v2")
    expect(updateSchemaVersion).toHaveBeenCalledWith("doc-v2", 2)
    expect(documentToPlainText(documentFromYjs(loaded)).length).toBeGreaterThan(
      0
    )
    loaded.destroy()
  })
})

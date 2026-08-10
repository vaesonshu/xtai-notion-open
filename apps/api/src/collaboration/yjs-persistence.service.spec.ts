import { afterEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import type { YjsPersistenceRepository } from "./yjs-persistence.repository"
import { YjsPersistenceService } from "./yjs-persistence.service"

function encodeTextUpdate(text: string): Uint8Array {
  const doc = new Y.Doc()
  doc.getText("content").insert(0, text)
  return Y.encodeStateAsUpdate(doc)
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
      listUpdatesAfter: vi.fn().mockResolvedValue([
        { update, sequence: 4 },
      ]),
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
})

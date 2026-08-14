import { HocuspocusProvider } from "@hocuspocus/provider"
import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as Y from "yjs"
import { AppModule } from "../app.module"
import { PrismaService } from "../database/prisma.module"
import type { PrismaClient } from "../generated/prisma/client"
import { CollaborationService } from "./collaboration.service"
import { YjsPersistenceService } from "./yjs-persistence.service"

const USERS = {
  owner: "collab-owner",
  editor: "collab-editor",
  viewer: "collab-viewer",
  outsider: "collab-outsider",
} as const

function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000,
  intervalMs = 50
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Timed out waiting for condition"))
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}

describe("collaboration (integration)", () => {
  let app: INestApplication
  let prisma: PrismaClient
  let persistence: YjsPersistenceService
  let collaboration: CollaborationService
  let workspaceId: string
  let documentId: string
  let websocketUrl: string

  async function seedDocument(): Promise<void> {
    workspaceId = randomUUID()
    documentId = randomUUID()

    await prisma.workspace.create({
      data: { id: workspaceId, name: "Collaboration Workspace" },
    })
    await prisma.document.create({
      data: { id: documentId, workspaceId, title: "Collaboration Document" },
    })

    for (const [userId, role] of [
      [USERS.owner, "owner"],
      [USERS.editor, "editor"],
      [USERS.viewer, "viewer"],
    ] as const) {
      await prisma.documentMember.create({
        data: { documentId, userId, role },
      })
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
    await app.listen(0)

    prisma = app.get(PrismaService).client
    persistence = app.get(YjsPersistenceService)
    collaboration = app.get(CollaborationService)

    const server = collaboration.getServer()
    if (!server) {
      throw new Error("Collaboration server was not started")
    }
    websocketUrl = server.webSocketURL

    await seedDocument()
  })

  afterAll(async () => {
    try {
      if (prisma && workspaceId) {
        await prisma.workspace.delete({ where: { id: workspaceId } })
      }
    } finally {
      await app?.close()
    }
  })

  function connect(
    userId: string,
    ydoc = new Y.Doc()
  ): {
    document: Y.Doc
    provider: HocuspocusProvider
  } {
    const provider = new HocuspocusProvider({
      url: websocketUrl,
      name: documentId,
      document: ydoc,
      token: userId,
    })
    return { document: ydoc, provider }
  }

  it("replays snapshot plus ordered updates after flush and compact", async () => {
    const first = new Y.Doc()
    first.getText("content").insert(0, "Hello")
    const firstUpdate = Y.encodeStateAsUpdate(first)

    const second = new Y.Doc()
    Y.applyUpdate(second, firstUpdate)
    second.getText("content").insert(5, " world")
    const secondUpdate = Y.encodeStateAsUpdate(
      second,
      Y.encodeStateVector(first)
    )

    persistence.enqueueUpdate(documentId, firstUpdate)
    persistence.enqueueUpdate(documentId, secondUpdate)
    await persistence.flushDocument(documentId)

    const loadedAfterFlush = await persistence.loadDocument(documentId)
    expect(loadedAfterFlush.getText("content").toString()).toBe("Hello world")
    loadedAfterFlush.destroy()

    await persistence.compactDocument(documentId)

    // After compact all per-document updates should be folded into a
    // snapshot, so the update table is empty and a snapshot exists.
    const updateCount = await prisma.yjsUpdate.count({
      where: { documentId },
    })
    expect(updateCount).toBe(0)

    const snapshotCount = await prisma.yjsSnapshot.count({
      where: { documentId },
    })
    expect(snapshotCount).toBeGreaterThan(0)

    const loadedAfterCompact = await persistence.loadDocument(documentId)
    expect(loadedAfterCompact.getText("content").toString()).toBe("Hello world")
    loadedAfterCompact.destroy()
    first.destroy()
    second.destroy()
  })

  it("syncs text between two editors in real time", async () => {
    const a = connect(USERS.owner)
    const b = connect(USERS.editor)

    await Promise.all([
      waitFor(() => a.provider.synced),
      waitFor(() => b.provider.synced),
    ])

    a.document.getText("content").insert(0, "pair-sync")

    await waitFor(() =>
      b.document.getText("content").toString().includes("pair-sync")
    )

    expect(b.document.getText("content").toString()).toContain("pair-sync")

    a.provider.destroy()
    b.provider.destroy()
    a.document.destroy()
    b.document.destroy()
  })

  it("rejects viewer writes while keeping read access", async () => {
    const editor = connect(USERS.editor)
    const viewer = connect(USERS.viewer)

    await Promise.all([
      waitFor(() => editor.provider.synced),
      waitFor(() => viewer.provider.synced),
    ])

    editor.document.getText("content").insert(0, "baseline-")
    await waitFor(() =>
      viewer.document.getText("content").toString().includes("baseline-")
    )

    const before = viewer.document.getText("content").toString()
    viewer.document.getText("content").insert(0, "viewer-write-")

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(editor.document.getText("content").toString()).toBe(before)
    expect(viewer.document.getText("content").toString()).not.toBe(before)

    editor.provider.destroy()
    viewer.provider.destroy()
    editor.document.destroy()
    viewer.document.destroy()
  })

  it("does not sync document state to non-members", async () => {
    const outsiderDoc = new Y.Doc()
    let authFailed = false
    const provider = new HocuspocusProvider({
      url: websocketUrl,
      name: documentId,
      document: outsiderDoc,
      token: USERS.outsider,
      onAuthenticationFailed: () => {
        authFailed = true
      },
    })

    await waitFor(() => authFailed || provider.synced === true, 5_000).catch(
      () => undefined
    )

    expect(authFailed).toBe(true)
    expect(outsiderDoc.getText("content").toString()).not.toContain("pair-sync")

    provider.destroy()
    outsiderDoc.destroy()
  })

  it("restores persisted content after collaboration service restart", async () => {
    const before = connect(USERS.owner)
    await waitFor(() => before.provider.synced)
    before.document.getText("content").insert(0, "persist-me")
    await waitFor(() =>
      before.document.getText("content").toString().includes("persist-me")
    )

    const snapshotUpdate = Y.encodeStateAsUpdate(before.document)
    persistence.enqueueUpdate(documentId, snapshotUpdate)
    await persistence.flushDocument(documentId)
    await persistence.compactDocument(documentId)

    before.provider.destroy()
    before.document.destroy()

    await app.close()
    await new Promise((resolve) => setTimeout(resolve, 250))

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    await app.listen(0)

    prisma = app.get(PrismaService).client
    persistence = app.get(YjsPersistenceService)
    collaboration = app.get(CollaborationService)
    const server = collaboration.getServer()
    if (!server) {
      throw new Error("Collaboration server did not restart")
    }
    websocketUrl = server.webSocketURL

    const loaded = await persistence.loadDocument(documentId)
    expect(loaded.getText("content").toString()).toContain("persist-me")
    loaded.destroy()

    const after = connect(USERS.editor)
    await waitFor(() => after.provider.synced, 10_000)
    await waitFor(
      () => after.document.getText("content").toString().includes("persist-me"),
      10_000
    )
    expect(after.document.getText("content").toString()).toContain("persist-me")

    after.provider.destroy()
    after.document.destroy()
  })
})

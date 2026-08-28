import { HocuspocusProvider } from "@hocuspocus/provider"
import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import {
  appendTextToBlockSchemaYDoc,
  blockSchemaYDocHasContent,
  createBlockSchemaYDoc,
  documentFromYjs,
  documentToPlainText,
  generateBlockId,
  type Block,
} from "@xtai-notion/editor-core/server"
import { randomUUID } from "node:crypto"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
import * as Y from "yjs"
import { AppModule } from "@api/app.module"
import { PrismaService } from "@api/database/prisma.module"
import type { PrismaClient } from "@api/generated/prisma/client"
import { CollaborationService } from "@api/collaboration/collaboration.service"
import { YjsPersistenceService } from "@api/collaboration/yjs-persistence.service"

const USERS = {
  owner: "collab-owner",
  editor: "collab-editor",
  viewer: "collab-viewer",
  outsider: "collab-outsider",
} as const

function waitFor(
  predicate: () => boolean,
  timeoutMs = 8_000,
  intervalMs = 50
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      try {
        if (predicate()) {
          resolve()
          return
        }
      } catch {
        // 同步过程中 Y.Doc 可能暂时无法解析，继续等
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

function createParagraphBlock(text: string): Block {
  return {
    id: generateBlockId(),
    type: "paragraph",
    props: {},
    content: [{ type: "text", text, styles: {} }],
    children: [],
  }
}

function yDocPlainText(doc: Y.Doc): string {
  try {
    return documentToPlainText(documentFromYjs(doc))
  } catch {
    return ""
  }
}

describe("collaboration (integration)", () => {
  let app: INestApplication
  let prisma: PrismaClient
  let persistence: YjsPersistenceService
  let collaboration: CollaborationService
  let workspaceId: string
  let documentId: string
  let websocketUrl: string

  async function createTestDocument(): Promise<void> {
    documentId = randomUUID()

    await prisma.document.create({
      data: {
        id: documentId,
        workspaceId,
        title: "Collaboration Document",
        schemaVersion: 2,
      },
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

    workspaceId = randomUUID()
    await prisma.workspace.create({
      data: { id: workspaceId, name: "Collaboration Workspace" },
    })
  })

  beforeEach(async () => {
    await createTestDocument()
  })

  afterEach(async () => {
    await persistence.flushAll().catch(() => undefined)
    if (documentId) {
      await prisma.document
        .delete({ where: { id: documentId } })
        .catch(() => undefined)
    }
  })

  afterAll(async () => {
    try {
      if (persistence) {
        await persistence.flushAll()
      }
      if (prisma && workspaceId) {
        await prisma.workspace.delete({ where: { id: workspaceId } })
      }
    } catch {
      // 重启类测试可能已关闭 app；teardown 失败不应拖死 hook
    } finally {
      await app?.close()
    }
  }, 90_000)

  // 客户端使用空 Y.Doc，避免各自 createBlockSchemaYDoc 抢先写入互不兼容的树
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

  async function seedPersistedText(text: string): Promise<void> {
    const seed = createBlockSchemaYDoc([createParagraphBlock(text)])
    persistence.enqueueUpdate(documentId, Y.encodeStateAsUpdate(seed))
    await persistence.flushDocument(documentId)
    seed.destroy()
  }

  it("replays snapshot plus ordered updates after flush and compact", async () => {
    const first = createBlockSchemaYDoc([createParagraphBlock("Hello")])
    const firstUpdate = Y.encodeStateAsUpdate(first)

    const second = new Y.Doc()
    Y.applyUpdate(second, firstUpdate)
    appendTextToBlockSchemaYDoc(second, " world")
    const secondUpdate = Y.encodeStateAsUpdate(
      second,
      Y.encodeStateVector(first)
    )

    persistence.enqueueUpdate(documentId, firstUpdate)
    persistence.enqueueUpdate(documentId, secondUpdate)
    await persistence.flushDocument(documentId)

    const loadedAfterFlush = await persistence.loadDocument(documentId)
    expect(yDocPlainText(loadedAfterFlush)).toBe("Hello world")
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
    expect(yDocPlainText(loadedAfterCompact)).toBe("Hello world")
    loadedAfterCompact.destroy()
    first.destroy()
    second.destroy()
  })

  it("syncs block schema text between two editors in real time", async () => {
    await seedPersistedText("seed-")
    const a = connect(USERS.owner)
    const b = connect(USERS.editor)

    await Promise.all([
      waitFor(() => a.provider.synced),
      waitFor(() => b.provider.synced),
    ])
    await Promise.all([
      waitFor(() => yDocPlainText(a.document).includes("seed-")),
      waitFor(() => yDocPlainText(b.document).includes("seed-")),
    ])

    appendTextToBlockSchemaYDoc(a.document, "pair-sync")

    await waitFor(() => yDocPlainText(b.document).includes("pair-sync"))

    expect(yDocPlainText(b.document)).toContain("pair-sync")
    expect(blockSchemaYDocHasContent(b.document)).toBe(true)

    a.provider.destroy()
    b.provider.destroy()
    a.document.destroy()
    b.document.destroy()
  })

  it("rejects viewer writes while keeping read access", async () => {
    await seedPersistedText("baseline-")
    const owner = connect(USERS.owner)
    const viewer = connect(USERS.viewer)

    await Promise.all([
      waitFor(() => owner.provider.synced),
      waitFor(() => viewer.provider.synced),
    ])
    await Promise.all([
      waitFor(() => yDocPlainText(owner.document).includes("baseline-")),
      waitFor(() => yDocPlainText(viewer.document).includes("baseline-")),
    ])

    const before = yDocPlainText(viewer.document)
    appendTextToBlockSchemaYDoc(viewer.document, "viewer-write-")

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(yDocPlainText(owner.document)).toBe(before)
    expect(yDocPlainText(viewer.document)).not.toBe(before)

    owner.provider.destroy()
    viewer.provider.destroy()
    owner.document.destroy()
    viewer.document.destroy()
  })

  it("does not sync document state to non-members", async () => {
    const outsiderDoc = createBlockSchemaYDoc()
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
    expect(yDocPlainText(outsiderDoc)).not.toContain("pair-sync")

    provider.destroy()
    outsiderDoc.destroy()
  })

  it("restores persisted block schema content after collaboration service restart", async () => {
    await seedPersistedText("persist-me")
    await persistence.compactDocument(documentId)

    const before = connect(USERS.owner)
    await waitFor(() => before.provider.synced, 10_000)
    await waitFor(
      () => yDocPlainText(before.document).includes("persist-me"),
      10_000
    )
    before.provider.destroy()
    before.document.destroy()

    await persistence.flushAll()
    await app.close()
    await new Promise((resolve) => setTimeout(resolve, 1_500))

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
    expect(yDocPlainText(loaded)).toContain("persist-me")
    loaded.destroy()

    const after = connect(USERS.editor)
    await waitFor(() => after.provider.synced, 15_000)
    await waitFor(
      () => yDocPlainText(after.document).includes("persist-me"),
      15_000
    )
    expect(yDocPlainText(after.document)).toContain("persist-me")

    after.provider.destroy()
    after.document.destroy()
  }, 90_000)
})

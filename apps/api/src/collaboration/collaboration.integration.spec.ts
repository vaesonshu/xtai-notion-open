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
} from "@workspace/editor-core"
import type { Block } from "@workspace/editor-core"
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
  return documentToPlainText(documentFromYjs(doc))
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
    ydoc = createBlockSchemaYDoc()
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
    const a = connect(USERS.owner)
    const b = connect(USERS.editor)

    await Promise.all([
      waitFor(() => a.provider.synced),
      waitFor(() => b.provider.synced),
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
    const editor = connect(USERS.editor)
    const viewer = connect(USERS.viewer)

    await Promise.all([
      waitFor(() => editor.provider.synced),
      waitFor(() => viewer.provider.synced),
    ])

    appendTextToBlockSchemaYDoc(editor.document, "baseline-")
    await waitFor(() => yDocPlainText(viewer.document).includes("baseline-"))

    const before = yDocPlainText(viewer.document)
    appendTextToBlockSchemaYDoc(viewer.document, "viewer-write-")

    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(yDocPlainText(editor.document)).toBe(before)
    expect(yDocPlainText(viewer.document)).not.toBe(before)

    editor.provider.destroy()
    viewer.provider.destroy()
    editor.document.destroy()
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
    const before = connect(USERS.owner)
    await waitFor(() => before.provider.synced)
    appendTextToBlockSchemaYDoc(before.document, "persist-me")
    await waitFor(() => yDocPlainText(before.document).includes("persist-me"))

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
    expect(yDocPlainText(loaded)).toContain("persist-me")
    loaded.destroy()

    const after = connect(USERS.editor)
    await waitFor(() => after.provider.synced, 10_000)
    await waitFor(
      () => yDocPlainText(after.document).includes("persist-me"),
      10_000
    )
    expect(yDocPlainText(after.document)).toContain("persist-me")

    after.provider.destroy()
    after.document.destroy()
  })
})

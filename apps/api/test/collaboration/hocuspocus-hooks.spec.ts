import { ForbiddenException, UnauthorizedException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import type { CollaborationAuthService } from "@api/collaboration/collaboration-auth.service"
import { createHocuspocusHooks } from "@api/collaboration/hocuspocus-hooks"
import type { YjsPersistenceService } from "@api/collaboration/yjs-persistence.service"

function createAuth(
  overrides: Partial<CollaborationAuthService> = {}
): CollaborationAuthService {
  return {
    authenticateConnection: vi.fn(),
    ...overrides,
  } as unknown as CollaborationAuthService
}

function createPersistence(
  overrides: Partial<YjsPersistenceService> = {}
): YjsPersistenceService {
  return {
    loadDocument: vi.fn(),
    enqueueUpdate: vi.fn(),
    flushDocument: vi.fn(),
    compactDocument: vi.fn(),
    flushAll: vi.fn(),
    ...overrides,
  } as unknown as YjsPersistenceService
}

describe("createHocuspocusHooks", () => {
  it("onAuthenticate grants writable access for editors", async () => {
    const auth = createAuth({
      authenticateConnection: vi.fn().mockResolvedValue({
        userId: "editor-1",
        role: "editor",
        readOnly: false,
      }),
    })
    const hooks = createHocuspocusHooks({
      auth,
      persistence: createPersistence(),
    })
    const connection = { readOnly: false }

    const context = await hooks.onAuthenticate({
      documentName: "doc-1",
      token: "editor-1",
      connection,
      requestHeaders: {},
    })

    expect(auth.authenticateConnection).toHaveBeenCalledWith({
      documentId: "doc-1",
      token: "editor-1",
      requestHeaders: {},
    })
    expect(connection.readOnly).toBe(false)
    expect(context).toEqual({
      userId: "editor-1",
      role: "editor",
      readOnly: false,
    })
  })

  it("onAuthenticate marks viewer sessions read-only", async () => {
    const auth = createAuth({
      authenticateConnection: vi.fn().mockResolvedValue({
        userId: "viewer-1",
        role: "viewer",
        readOnly: true,
      }),
    })
    const hooks = createHocuspocusHooks({
      auth,
      persistence: createPersistence(),
    })
    const connection = { readOnly: false }

    await hooks.onAuthenticate({
      documentName: "doc-1",
      token: "viewer-1",
      connection,
      requestHeaders: {},
    })

    expect(connection.readOnly).toBe(true)
  })

  it("onAuthenticate rejects invalid identity and non-members", async () => {
    const auth = createAuth({
      authenticateConnection: vi
        .fn()
        .mockRejectedValueOnce(new UnauthorizedException("missing identity"))
        .mockRejectedValueOnce(new ForbiddenException("Not a document member")),
    })
    const hooks = createHocuspocusHooks({
      auth,
      persistence: createPersistence(),
    })

    await expect(
      hooks.onAuthenticate({
        documentName: "doc-1",
        token: "",
        connection: { readOnly: false },
        requestHeaders: {},
      })
    ).rejects.toBeInstanceOf(UnauthorizedException)

    await expect(
      hooks.onAuthenticate({
        documentName: "doc-1",
        token: "outsider",
        connection: { readOnly: false },
        requestHeaders: {},
      })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("onLoadDocument loads persisted Y.Doc state", async () => {
    const doc = new Y.Doc()
    doc.getText("content").insert(0, "persisted")
    const persistence = createPersistence({
      loadDocument: vi.fn().mockResolvedValue(doc),
    })
    const hooks = createHocuspocusHooks({
      auth: createAuth(),
      persistence,
    })

    const loaded = await hooks.onLoadDocument({ documentName: "doc-1" })
    expect(persistence.loadDocument).toHaveBeenCalledWith("doc-1")
    expect(loaded).toBe(doc)
  })

  it("onChange enqueues updates for persistence", async () => {
    const persistence = createPersistence()
    const hooks = createHocuspocusHooks({
      auth: createAuth(),
      persistence,
    })
    const update = new Uint8Array([1, 2, 3])

    await hooks.onChange({
      documentName: "doc-1",
      update,
    })

    expect(persistence.enqueueUpdate).toHaveBeenCalledWith("doc-1", update)
  })

  it("onStoreDocument flushes buffered updates and surfaces persistence failures", async () => {
    const persistence = createPersistence({
      flushDocument: vi.fn().mockResolvedValue(undefined),
    })
    const hooks = createHocuspocusHooks({
      auth: createAuth(),
      persistence,
    })

    await hooks.onStoreDocument({ documentName: "doc-1" })
    expect(persistence.flushDocument).toHaveBeenCalledWith("doc-1")

    const failing = createPersistence({
      flushDocument: vi.fn().mockRejectedValue(new Error("db down")),
    })
    const failingHooks = createHocuspocusHooks({
      auth: createAuth(),
      persistence: failing,
    })

    await expect(
      failingHooks.onStoreDocument({ documentName: "doc-1" })
    ).rejects.toThrow("db down")
  })
})

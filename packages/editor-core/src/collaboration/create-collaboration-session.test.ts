import { describe, expect, it, vi } from "vitest"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import { createCollaborationSession } from "./create-collaboration-session"
import type { CollaborationConfig } from "./types"

type ProviderListener = (...args: unknown[]) => void

type MockProvider = {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  emit: (event: string, ...args: unknown[]) => void
  listenerCount: (event: string) => number
}

function createMockProvider(): MockProvider {
  const listeners = new Map<string, Set<ProviderListener>>()

  const on = vi.fn((event: string, listener: ProviderListener) => {
    const set = listeners.get(event) ?? new Set<ProviderListener>()
    set.add(listener)
    listeners.set(event, set)
    return mock
  })

  const off = vi.fn((event: string, listener?: ProviderListener) => {
    const set = listeners.get(event)
    if (!set) {
      return mock
    }
    if (listener) {
      set.delete(listener)
    } else {
      set.clear()
    }
    if (set.size === 0) {
      listeners.delete(event)
    }
    return mock
  })

  const destroy = vi.fn(() => {
    listeners.clear()
  })

  const mock: MockProvider = {
    on,
    off,
    destroy,
    emit(event, ...args) {
      const set = listeners.get(event)
      if (!set) {
        return
      }
      for (const listener of [...set]) {
        listener(...args)
      }
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0
    },
  }

  return mock
}

const baseConfig: CollaborationConfig = {
  documentId: "doc-room-1",
  websocketUrl: "ws://localhost:1234",
  token: "dev-token",
  user: {
    id: "user-1",
    name: "Ada",
    color: "#2563eb",
  },
}

describe("createCollaborationSession", () => {
  it("starts connecting and uses documentId as the provider room name", () => {
    const provider = createMockProvider()
    const createProvider = vi.fn(
      () => provider as unknown as HocuspocusProvider,
    )

    const session = createCollaborationSession(baseConfig, { createProvider })

    expect(session.getStatus()).toBe("connecting")
    expect(createProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "doc-room-1",
        url: "ws://localhost:1234",
        token: "dev-token",
        document: session.document,
      }),
    )
    expect(session.provider).toBe(provider)
    expect(session.document).toBeInstanceOf(Y.Doc)

    session.destroy()
  })

  it("maps first sync to synced status", () => {
    const provider = createMockProvider()
    const session = createCollaborationSession(baseConfig, {
      createProvider: () => provider as unknown as HocuspocusProvider,
    })

    expect(session.getStatus()).toBe("connecting")

    provider.emit("synced", { state: true })

    expect(session.getStatus()).toBe("synced")

    session.destroy()
  })

  it("maps disconnect to offline status", () => {
    const provider = createMockProvider()
    const session = createCollaborationSession(baseConfig, {
      createProvider: () => provider as unknown as HocuspocusProvider,
    })

    provider.emit("synced", { state: true })
    provider.emit("status", { status: "disconnected" })

    expect(session.getStatus()).toBe("offline")

    session.destroy()
  })

  it("maps authenticationFailed to unauthorized and close errors to error", () => {
    const unauthorizedProvider = createMockProvider()
    const unauthorizedSession = createCollaborationSession(baseConfig, {
      createProvider: () => unauthorizedProvider as unknown as HocuspocusProvider,
    })

    unauthorizedProvider.emit("authenticationFailed", {
      reason: "permission-denied",
    })
    expect(unauthorizedSession.getStatus()).toBe("unauthorized")
    unauthorizedSession.destroy()

    const errorProvider = createMockProvider()
    const errorSession = createCollaborationSession(baseConfig, {
      createProvider: () => errorProvider as unknown as HocuspocusProvider,
    })

    errorProvider.emit("close", {
      event: { code: 1011, reason: "persistence-failed" },
    })
    expect(errorSession.getStatus()).toBe("error")
    errorSession.destroy()
  })

  it("keeps unauthorized after disconnect or normal close", () => {
    const provider = createMockProvider()
    const session = createCollaborationSession(baseConfig, {
      createProvider: () => provider as unknown as HocuspocusProvider,
    })

    provider.emit("authenticationFailed", { reason: "permission-denied" })
    expect(session.getStatus()).toBe("unauthorized")

    provider.emit("status", { status: "disconnected" })
    expect(session.getStatus()).toBe("unauthorized")

    provider.emit("close", { event: { code: 1000 } })
    expect(session.getStatus()).toBe("unauthorized")

    session.destroy()
  })

  it("keeps error after subsequent offline disconnect", () => {
    const provider = createMockProvider()
    const session = createCollaborationSession(baseConfig, {
      createProvider: () => provider as unknown as HocuspocusProvider,
    })

    provider.emit("close", {
      event: { code: 1011, reason: "persistence-failed" },
    })
    expect(session.getStatus()).toBe("error")

    provider.emit("status", { status: "disconnected" })
    expect(session.getStatus()).toBe("error")

    provider.emit("close", { event: { code: 1000 } })
    expect(session.getStatus()).toBe("error")

    session.destroy()
  })

  it("destroy removes listeners and destroys the Y.Doc", () => {
    const provider = createMockProvider()
    const session = createCollaborationSession(baseConfig, {
      createProvider: () => provider as unknown as HocuspocusProvider,
    })
    const document = session.document

    expect(provider.listenerCount("synced")).toBeGreaterThan(0)
    expect(provider.listenerCount("status")).toBeGreaterThan(0)
    expect(provider.listenerCount("authenticationFailed")).toBeGreaterThan(0)
    expect(provider.listenerCount("close")).toBeGreaterThan(0)

    session.destroy()

    expect(provider.off).toHaveBeenCalled()
    expect(provider.destroy).toHaveBeenCalledTimes(1)
    expect(document.isDestroyed).toBe(true)
    expect(provider.listenerCount("synced")).toBe(0)
    expect(provider.listenerCount("status")).toBe(0)
    expect(provider.listenerCount("authenticationFailed")).toBe(0)
    expect(provider.listenerCount("close")).toBe(0)

    provider.emit("synced", { state: true })
    provider.emit("status", { status: "disconnected" })
    expect(session.getStatus()).not.toBe("synced")
    expect(session.getStatus()).not.toBe("offline")
  })
})

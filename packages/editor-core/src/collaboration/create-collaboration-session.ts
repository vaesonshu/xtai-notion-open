import {
  HocuspocusProvider,
  type HocuspocusProviderConfiguration,
  WebSocketStatus,
} from "@hocuspocus/provider"
import * as Y from "yjs"
import type {
  CollaborationConfig,
  CollaborationSession,
  CollaborationStatus,
} from "./types"

export type CreateProviderOptions = {
  name: string
  url: string
  document: Y.Doc
  token: string
}

export type CreateProvider = (
  options: CreateProviderOptions,
) => HocuspocusProvider

export type CreateCollaborationSessionOptions = {
  createProvider?: CreateProvider
}

const defaultCreateProvider: CreateProvider = ({
  name,
  url,
  document,
  token,
}) =>
  new HocuspocusProvider({
    name,
    url,
    document,
    token,
  } satisfies HocuspocusProviderConfiguration)

export function createCollaborationSession(
  config: CollaborationConfig,
  options: CreateCollaborationSessionOptions = {},
): CollaborationSession {
  const document = new Y.Doc()
  const createProvider = options.createProvider ?? defaultCreateProvider
  const provider = createProvider({
    name: config.documentId,
    url: config.websocketUrl,
    document,
    token: config.token,
  })

  let status: CollaborationStatus = "connecting"
  let destroyed = false

  const isTerminalStatus = (value: CollaborationStatus) =>
    value === "unauthorized" || value === "error"

  const setStatus = (next: CollaborationStatus) => {
    if (destroyed) {
      return
    }
    // Auth/transport failures must stick; Hocuspocus often emits disconnect/close after.
    if (isTerminalStatus(status) && next !== status) {
      return
    }
    status = next
  }

  const handleSynced = (data: { state: boolean }) => {
    if (data.state) {
      setStatus("synced")
    }
  }

  const handleStatus = (data: { status: WebSocketStatus | string }) => {
    if (data.status === WebSocketStatus.Disconnected || data.status === "disconnected") {
      setStatus("offline")
    }
  }

  const handleAuthenticationFailed = () => {
    setStatus("unauthorized")
  }

  const handleClose = (data: { event?: { code?: number; reason?: string } }) => {
    const code = data.event?.code
    if (code === undefined || code === 1000 || code === 1001) {
      setStatus("offline")
      return
    }
    setStatus("error")
  }

  provider.on("synced", handleSynced)
  provider.on("status", handleStatus)
  provider.on("authenticationFailed", handleAuthenticationFailed)
  provider.on("close", handleClose)

  return {
    document,
    provider,
    getStatus: () => status,
    destroy: () => {
      if (destroyed) {
        return
      }
      destroyed = true
      provider.off("synced", handleSynced)
      provider.off("status", handleStatus)
      provider.off("authenticationFailed", handleAuthenticationFailed)
      provider.off("close", handleClose)
      provider.destroy()
      document.destroy()
    },
  }
}

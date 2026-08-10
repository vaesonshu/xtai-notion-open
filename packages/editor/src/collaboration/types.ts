import type { HocuspocusProvider } from "@hocuspocus/provider"
import type * as Y from "yjs"
import type { CollaborationUser } from "../core/types"

export type CollaborationStatus =
  | "connecting"
  | "synced"
  | "offline"
  | "unauthorized"
  | "error"

export type CollaborationConfig = {
  documentId: string
  websocketUrl: string
  token: string
  user: CollaborationUser
}

export type CollaborationSession = {
  document: Y.Doc
  provider: HocuspocusProvider
  getStatus: () => CollaborationStatus
  destroy: () => void
}

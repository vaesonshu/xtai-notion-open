import type { Doc } from "yjs"
import type {
  CollaborationAuthService,
  CollaborationConnectionAuth,
} from "./collaboration-auth.service"
import type { YjsPersistenceService } from "./yjs-persistence.service"

export type HocuspocusAuthenticatePayload = {
  documentName: string
  token: string
  connection: { readOnly: boolean }
  requestHeaders: Record<string, string | string[] | undefined>
}

export type HocuspocusDocumentPayload = {
  documentName: string
}

export type HocuspocusChangePayload = {
  documentName: string
  update: Uint8Array
}

export type HocuspocusHooks = {
  onAuthenticate: (
    data: HocuspocusAuthenticatePayload
  ) => Promise<CollaborationConnectionAuth>
  onLoadDocument: (data: HocuspocusDocumentPayload) => Promise<Doc>
  onChange: (data: HocuspocusChangePayload) => Promise<void>
  onStoreDocument: (data: HocuspocusDocumentPayload) => Promise<void>
}

export type CreateHocuspocusHooksDeps = {
  auth: CollaborationAuthService
  persistence: YjsPersistenceService
}

export function createHocuspocusHooks(
  deps: CreateHocuspocusHooksDeps
): HocuspocusHooks {
  const { auth, persistence } = deps

  return {
    async onAuthenticate(data) {
      const result = await auth.authenticateConnection({
        documentId: data.documentName,
        token: data.token,
        requestHeaders: data.requestHeaders,
      })
      data.connection.readOnly = result.readOnly
      return result
    },

    async onLoadDocument(data) {
      return persistence.loadDocument(data.documentName)
    },

    async onChange(data) {
      persistence.enqueueUpdate(data.documentName, data.update)
    },

    async onStoreDocument(data) {
      await persistence.flushDocument(data.documentName)
    },
  }
}

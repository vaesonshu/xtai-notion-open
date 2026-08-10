import { Inject, Injectable } from "@nestjs/common"
import { Server } from "@hocuspocus/server"
import type { Environment } from "../config/environment"
import { ENVIRONMENT } from "../database/database.tokens"
import { CollaborationAuthService } from "./collaboration-auth.service"
import { createHocuspocusHooks } from "./hocuspocus-hooks"
import { YjsPersistenceService } from "./yjs-persistence.service"

function headersToRecord(
  headers: Headers
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {}
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value
  })
  return result
}

@Injectable()
export class HocuspocusFactory {
  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment,
    @Inject(CollaborationAuthService)
    private readonly auth: CollaborationAuthService,
    @Inject(YjsPersistenceService)
    private readonly persistence: YjsPersistenceService
  ) {}

  create(): Server {
    const hooks = createHocuspocusHooks({
      auth: this.auth,
      persistence: this.persistence,
    })

    return new Server({
      port: this.env.COLLABORATION_PORT,
      quiet: this.env.NODE_ENV === "test",
      stopOnSignals: false,
      debounce: 2_000,
      maxDebounce: 10_000,
      async onAuthenticate(data) {
        return hooks.onAuthenticate({
          documentName: data.documentName,
          token: data.token ?? "",
          connection: data.connectionConfig,
          requestHeaders: headersToRecord(data.requestHeaders),
        })
      },
      async onLoadDocument(data) {
        return hooks.onLoadDocument({ documentName: data.documentName })
      },
      async onChange(data) {
        await hooks.onChange({
          documentName: data.documentName,
          update: data.update,
        })
      },
      async onStoreDocument(data) {
        await hooks.onStoreDocument({ documentName: data.documentName })
      },
    })
  }
}

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import type { Server } from "@hocuspocus/server"
import type { Environment } from "../config/environment"
import { ENVIRONMENT } from "../config/tokens"
import { HocuspocusFactory } from "./hocuspocus.factory"
import { YjsPersistenceService } from "./yjs-persistence.service"

// Hocuspocus binds a long-lived WebSocket/TCP port on init; serverless
// runtimes (e.g. Vercel) cannot own a listening port, so the WS server is
// skipped there and real-time collaboration is served by a separate
// long-running deployment instead.
const isServerless = process.env.VERCEL === "1"

@Injectable()
export class CollaborationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationService.name)
  private server: Server | null = null

  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment,
    @Inject(HocuspocusFactory) private readonly factory: HocuspocusFactory,
    @Inject(YjsPersistenceService)
    private readonly persistence: YjsPersistenceService
  ) {}

  async onModuleInit(): Promise<void> {
    this.server = this.factory.create()
    if (isServerless) {
      // No listening port is available inside a serverless function; real-time
      // collaboration WS is provided by a dedicated (non-serverless) deploy.
      this.logger.warn(
        "Collaboration WebSocket server disabled in serverless runtime"
      )
      return
    }
    await this.server.listen()
    this.logger.log(
      `Collaboration server listening on port ${this.env.COLLABORATION_PORT}`
    )
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.persistence.flushAll()
    } catch (error) {
      this.logger.error(
        "Failed to flush collaboration persistence buffers on shutdown",
        error instanceof Error ? error.stack : undefined
      )
    }

    if (this.server) {
      await this.server.destroy()
      this.server = null
    }
  }

  getServer(): Server | null {
    return this.server
  }
}

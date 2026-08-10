import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import type { Server } from "@hocuspocus/server"
import type { Environment } from "../config/environment"
import { ENVIRONMENT } from "../database/database.tokens"
import { HocuspocusFactory } from "./hocuspocus.factory"
import { YjsPersistenceService } from "./yjs-persistence.service"

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

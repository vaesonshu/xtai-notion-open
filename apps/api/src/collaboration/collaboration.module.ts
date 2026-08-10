import { Module } from "@nestjs/common"
import { DocumentsModule } from "../documents/documents.module"
import { CollaborationAuthService } from "./collaboration-auth.service"
import { CollaborationService } from "./collaboration.service"
import { HocuspocusFactory } from "./hocuspocus.factory"
import { YjsPersistenceRepository } from "./yjs-persistence.repository"
import { YjsPersistenceService } from "./yjs-persistence.service"

@Module({
  imports: [DocumentsModule],
  providers: [
    YjsPersistenceRepository,
    YjsPersistenceService,
    CollaborationAuthService,
    HocuspocusFactory,
    CollaborationService,
  ],
  exports: [
    CollaborationService,
    CollaborationAuthService,
    YjsPersistenceService,
  ],
})
export class CollaborationModule {}

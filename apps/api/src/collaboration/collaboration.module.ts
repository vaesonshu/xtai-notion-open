import { Module } from "@nestjs/common"
import { DocumentsModule } from "../documents/documents.module"
import { AuthModule } from "../auth/auth.module"
import { CollaborationAuthService } from "./collaboration-auth.service"
import { CollaborationService } from "./collaboration.service"
import { HocuspocusFactory } from "./hocuspocus.factory"
import { YjsPersistenceModule } from "./yjs-persistence.module"

@Module({
  imports: [DocumentsModule, AuthModule, YjsPersistenceModule],
  providers: [
    CollaborationAuthService,
    HocuspocusFactory,
    CollaborationService,
  ],
  exports: [
    CollaborationService,
    CollaborationAuthService,
    YjsPersistenceModule,
  ],
})
export class CollaborationModule {}

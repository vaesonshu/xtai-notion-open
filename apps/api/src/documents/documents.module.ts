import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { YjsPersistenceModule } from "../collaboration/yjs-persistence.module"
import { WorkspaceRepositoryModule } from "../workspaces/workspace-repository.module"
import { DocumentsRepositoryModule } from "./documents-repository.module"
import {
  DocumentsController,
  PublicationAdminController,
  PublicSquareController,
  ShareLinkController,
} from "./documents.controller"
import { DocumentsRepository } from "./documents.repository"
import { DocumentsService } from "./documents.service"
import { ShareLinkRepository } from "./share-link.repository"
import { ShareLinkService } from "./share-link.service"

@Module({
  imports: [
    AuthModule,
    YjsPersistenceModule,
    DocumentsRepositoryModule,
    WorkspaceRepositoryModule,
  ],
  controllers: [
    DocumentsController,
    ShareLinkController,
    PublicationAdminController,
    PublicSquareController,
  ],
  providers: [
    DocumentsService,
    ShareLinkRepository,
    ShareLinkService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}

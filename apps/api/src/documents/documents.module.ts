import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
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
  imports: [AuthModule],
  controllers: [
    DocumentsController,
    ShareLinkController,
    PublicationAdminController,
    PublicSquareController,
  ],
  providers: [
    DocumentsRepository,
    DocumentsService,
    ShareLinkRepository,
    ShareLinkService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}

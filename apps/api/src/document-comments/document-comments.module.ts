import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { DocumentsModule } from "../documents/documents.module"
import { DocumentCommentsController } from "./document-comments.controller"
import { DocumentCommentsRepository } from "./document-comments.repository"
import { DocumentCommentsService } from "./document-comments.service"

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [DocumentCommentsController],
  providers: [DocumentCommentsRepository, DocumentCommentsService],
})
export class DocumentCommentsModule {}

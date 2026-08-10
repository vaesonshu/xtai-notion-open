import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { DocumentsController } from "./documents.controller"
import { DocumentsRepository } from "./documents.repository"
import { DocumentsService } from "./documents.service"

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsRepository, DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

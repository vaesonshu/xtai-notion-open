import { Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { DevelopmentIdentityGuard } from "../auth/development-identity.guard"
import type { DocumentMetadata } from "./document-types"
import { DocumentsService } from "./documents.service"

@Controller("documents")
@UseGuards(DevelopmentIdentityGuard)
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  @Post()
  createDocument(@CurrentUser() user: DevUser): Promise<DocumentMetadata> {
    return this.documents.createDocument(user.id)
  }

  @Get(":documentId")
  getDocument(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.getDocument(documentId, user.id)
  }
}

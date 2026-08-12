import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { DevelopmentIdentityGuard } from "../auth/development-identity.guard"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type { DocumentMetadata } from "./document-types"
import { DocumentsService } from "./documents.service"

@Controller("documents")
@UseGuards(AuthenticatedIdentityGuard)
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  @Post()
  createDocument(
    @CurrentUser() user: DevUser,
    @Body() body: { parentId?: string } = {}
  ): Promise<DocumentMetadata> {
    if (body.parentId)
      return this.documents.createChildDocument(body.parentId, user.id)
    return this.documents.createDocument(user.id)
  }

  @Get()
  listDocuments(@CurrentUser() user: DevUser): Promise<DocumentMetadata[]> {
    return this.documents.listDocuments(user.id)
  }

  @Get(":documentId")
  getDocument(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.getDocument(documentId, user.id)
  }

  @Patch(":documentId")
  renameDocument(
    @Param("documentId") documentId: string,
    @Body() body: { title?: string },
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.renameDocument(documentId, user.id, body.title ?? "")
  }

  @Delete(":documentId")
  deleteDocument(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<void> {
    return this.documents.deleteDocument(documentId, user.id)
  }
}

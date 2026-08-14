import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Optional,
  UseGuards,
} from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type { DocumentMetadata, PublishedArticle } from "./document-types"
import { DocumentsService } from "./documents.service"
import { ShareLinkService } from "./share-link.service"

@Controller("documents")
@UseGuards(AuthenticatedIdentityGuard)
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Optional()
    @Inject(ShareLinkService)
    private readonly shareLinks?: ShareLinkService
  ) {}

  // Share creation remains behind the same document membership guard.
  @Post(":documentId/share-link")
  createShareLink(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<{ token: string }> {
    if (!this.shareLinks) throw new Error("Share link service unavailable")
    return this.shareLinks.createOrGet(documentId, user.id)
  }

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

  @Post(":documentId/submit-publication")
  submitPublication(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    // Service owns membership rules so this endpoint cannot drift from sharing.
    return this.documents.submitPublication(documentId, user.id)
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

@Controller("admin/publications")
@UseGuards(AuthenticatedIdentityGuard)
export class PublicationAdminController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  @Get()
  listPending(@CurrentUser() user: DevUser): Promise<DocumentMetadata[]> {
    return this.documents.listPendingPublications(user.id)
  }

  @Post(":documentId/approve")
  approve(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.approvePublication(documentId, user.id)
  }

  @Post(":documentId/reject")
  reject(
    @Param("documentId") documentId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.rejectPublication(
      documentId,
      user.id,
      body.reason ?? ""
    )
  }
}

@Controller("square")
export class PublicSquareController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  @Get("articles")
  listArticles(): Promise<PublishedArticle[]> {
    return this.documents.listPublishedArticles()
  }
}

@Controller("share")
@UseGuards(AuthenticatedIdentityGuard)
export class ShareLinkController {
  constructor(
    @Inject(ShareLinkService) private readonly shareLinks: ShareLinkService
  ) {}

  @Post(":token/accept")
  accept(
    @Param("token") token: string,
    @CurrentUser() user: DevUser
  ): Promise<{ documentId: string; role: "owner" | "editor" }> {
    // Preserve the repository's owner role when an existing member accepts.
    return this.shareLinks.accept(token, user.id)
  }
}

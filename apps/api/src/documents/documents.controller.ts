import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Optional,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common"
import type { Block } from "@xtai-notion/editor-core/server"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type {
  DocumentMetadata,
  DocumentSearchResult,
  PublishedArticle,
  PublishedArticleDetail,
  DocumentGraphNode,
  DocumentVersionSummary,
} from "./document-types"
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
  listDocuments(
    @CurrentUser() user: DevUser,
    @Query("workspaceId") workspaceId?: string
  ): Promise<DocumentMetadata[]> {
    return this.documents.listDocuments(user.id, workspaceId)
  }

  @Get("search")
  searchDocuments(
    @CurrentUser() user: DevUser,
    @Query("q") query = ""
  ): Promise<DocumentSearchResult[]> {
    return this.documents.searchDocuments(user.id, query)
  }

  @Get("trash")
  listTrashedDocuments(
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata[]> {
    return this.documents.listTrashedDocuments(user.id)
  }

  @Get("favorites")
  listFavoriteDocuments(
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata[]> {
    return this.documents.listFavoriteDocuments(user.id)
  }

  @Get("recent")
  listRecentDocuments(
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata[]> {
    return this.documents.listRecentDocuments(user.id)
  }

  @Post("import")
  importMarkdown(
    @CurrentUser() user: DevUser,
    @Body() body: { title?: string; markdown?: string }
  ): Promise<DocumentMetadata> {
    return this.documents.importMarkdown(
      user.id,
      body.title ?? "导入的文档",
      body.markdown ?? ""
    )
  }

  @Get("graph")
  listDocumentGraph(
    @CurrentUser() user: DevUser
  ): Promise<DocumentGraphNode[]> {
    return this.documents.listDocumentGraph(user.id)
  }

  @Get("quota")
  getOwnedDocumentQuota(
    @CurrentUser() user: DevUser
  ): Promise<{ used: number; limit: number }> {
    return this.documents.getOwnedDocumentQuota(user.id)
  }

  @Get(":documentId")
  getDocument(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.getDocument(documentId, user.id)
  }

  @Get(":documentId/content")
  getDocumentContent(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<{ content: Block[] }> {
    return this.documents
      .getDocumentContent(documentId, user.id)
      .then((content) => ({ content }))
  }

  @Put(":documentId/content")
  saveDocumentContent(
    @Param("documentId") documentId: string,
    @Body() body: { content?: Block[] },
    @CurrentUser() user: DevUser
  ): Promise<{ ok: true }> {
    if (!Array.isArray(body.content)) {
      throw new BadRequestException("Invalid document content payload")
    }
    return this.documents
      .saveDocumentContent(documentId, user.id, body.content)
      .then(() => ({ ok: true as const }))
  }

  @Post(":documentId/submit-publication")
  submitPublication(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    // Service owns membership rules so this endpoint cannot drift from sharing.
    return this.documents.submitPublication(documentId, user.id)
  }

  @Get(":documentId/versions")
  listDocumentVersions(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentVersionSummary[]> {
    return this.documents.listDocumentVersions(documentId, user.id)
  }

  @Post(":documentId/versions")
  saveDocumentVersion(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentVersionSummary> {
    return this.documents.saveDocumentVersion(documentId, user.id)
  }

  @Post(":documentId/versions/:versionId/restore")
  restoreDocumentVersion(
    @Param("documentId") documentId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: DevUser
  ): Promise<void> {
    return this.documents.restoreDocumentVersion(documentId, versionId, user.id)
  }

  @Patch(":documentId")
  renameDocument(
    @Param("documentId") documentId: string,
    @Body() body: { title?: string },
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.renameDocument(documentId, user.id, body.title ?? "")
  }

  @Patch(":documentId/pref")
  updateDocumentPref(
    @Param("documentId") documentId: string,
    @Body()
    body: { isFavorite?: boolean; recordOpened?: boolean },
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.updateDocumentPref(documentId, user.id, body)
  }

  @Post(":documentId/restore")
  restoreDocument(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata> {
    return this.documents.restoreDocument(documentId, user.id)
  }

  @Delete(":documentId")
  deleteDocument(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<void> {
    return this.documents.deleteDocument(documentId, user.id)
  }

  @Delete(":documentId/permanent")
  purgeDocument(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser
  ): Promise<void> {
    return this.documents.purgeDocument(documentId, user.id)
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

  @Get("articles/:documentId")
  getArticle(
    @Param("documentId") documentId: string
  ): Promise<PublishedArticleDetail> {
    return this.documents.getPublishedArticle(documentId)
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

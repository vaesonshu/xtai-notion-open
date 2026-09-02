import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type {
  DocumentCommentNode,
  DocumentCommentRecord,
} from "./document-comment-types"
import { DocumentCommentsService } from "./document-comments.service"

@Controller("documents")
@UseGuards(AuthenticatedIdentityGuard)
export class DocumentCommentsController {
  constructor(
    @Inject(DocumentCommentsService)
    private readonly comments: DocumentCommentsService
  ) {}

  @Get(":documentId/comments")
  listComments(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser,
    @Query("blockId") blockId?: string
  ): Promise<DocumentCommentNode[]> {
    return this.comments.listComments(documentId, user.id, blockId)
  }

  @Post(":documentId/comments")
  createComment(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { body?: string; blockId?: string; parentId?: string }
  ): Promise<DocumentCommentRecord> {
    return this.comments.createComment(documentId, user.id, body)
  }
}

import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type { ArticleCommentNode, ArticleCommentRecord } from "./comment-types"
import { CommentsService } from "./comments.service"

@Controller("square/articles")
export class SquareArticleCommentsController {
  constructor(
    @Inject(CommentsService) private readonly comments: CommentsService
  ) {}

  @Get(":documentId/comments")
  listComments(
    @Param("documentId") documentId: string
  ): Promise<ArticleCommentNode[]> {
    return this.comments.listComments(documentId)
  }

  @Post(":documentId/comments")
  @UseGuards(AuthenticatedIdentityGuard)
  createComment(
    @Param("documentId") documentId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { body?: string; parentId?: string }
  ): Promise<ArticleCommentRecord> {
    return this.comments.createComment(documentId, user.id, body)
  }
}

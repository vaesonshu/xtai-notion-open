import { Inject, Injectable } from "@nestjs/common"
import { PrismaService } from "../database/prisma.module"
import type { ArticleCommentRecord } from "./comment-types"

type CommentWithUser = {
  id: string
  articleId: string
  parentId: string | null
  depth: number
  body: string
  userId: string
  createdAt: Date
  user: { displayName: string; color: string }
}

@Injectable()
export class CommentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toRecord(comment: CommentWithUser): ArticleCommentRecord {
    return {
      id: comment.id,
      articleId: comment.articleId,
      parentId: comment.parentId,
      depth: comment.depth,
      body: comment.body,
      authorId: comment.userId,
      authorName: comment.user.displayName,
      authorColor: comment.user.color,
      createdAt: comment.createdAt,
    }
  }

  async isPublishedArticle(articleId: string): Promise<boolean> {
    const document = await this.prisma.client.document.findFirst({
      where: { id: articleId, publicationStatus: "published" },
      select: { id: true },
    })
    return Boolean(document)
  }

  async findById(commentId: string): Promise<ArticleCommentRecord | null> {
    const comment = await this.prisma.client.articleComment.findUnique({
      where: { id: commentId },
      include: { user: { select: { displayName: true, color: true } } },
    })
    return comment ? this.toRecord(comment) : null
  }

  async listForArticle(articleId: string): Promise<ArticleCommentRecord[]> {
    const comments = await this.prisma.client.articleComment.findMany({
      where: { articleId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { user: { select: { displayName: true, color: true } } },
    })
    return comments.map((comment) => this.toRecord(comment))
  }

  async create(input: {
    articleId: string
    userId: string
    parentId: string | null
    depth: number
    body: string
  }): Promise<ArticleCommentRecord> {
    const comment = await this.prisma.client.articleComment.create({
      data: {
        articleId: input.articleId,
        userId: input.userId,
        parentId: input.parentId,
        depth: input.depth,
        body: input.body,
      },
      include: { user: { select: { displayName: true, color: true } } },
    })
    return this.toRecord(comment)
  }
}

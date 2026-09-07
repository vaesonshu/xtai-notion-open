import { Inject, Injectable } from "@nestjs/common"
import { PrismaService } from "../database/prisma.module"
import type { DocumentCommentRecord } from "./document-comment-types"

type CommentWithUser = {
  id: string
  documentId: string
  blockId: string
  anchorFrom: number | null
  anchorTo: number | null
  parentId: string | null
  depth: number
  body: string
  userId: string
  createdAt: Date
  user: { displayName: string; color: string }
}

@Injectable()
export class DocumentCommentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toRecord(comment: CommentWithUser): DocumentCommentRecord {
    return {
      id: comment.id,
      documentId: comment.documentId,
      blockId: comment.blockId,
      anchorFrom: comment.anchorFrom,
      anchorTo: comment.anchorTo,
      parentId: comment.parentId,
      depth: comment.depth,
      body: comment.body,
      authorId: comment.userId,
      authorName: comment.user.displayName,
      authorColor: comment.user.color,
      createdAt: comment.createdAt,
    }
  }

  async findById(commentId: string): Promise<DocumentCommentRecord | null> {
    const comment = await this.prisma.client.documentComment.findUnique({
      where: { id: commentId },
      include: { user: { select: { displayName: true, color: true } } },
    })
    return comment ? this.toRecord(comment) : null
  }

  async listForDocument(
    documentId: string,
    blockId?: string
  ): Promise<DocumentCommentRecord[]> {
    const comments = await this.prisma.client.documentComment.findMany({
      where: {
        documentId,
        ...(blockId ? { blockId } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { user: { select: { displayName: true, color: true } } },
    })
    return comments.map((comment) => this.toRecord(comment))
  }

  async create(input: {
    documentId: string
    blockId: string
    anchorFrom?: number | null
    anchorTo?: number | null
    userId: string
    parentId: string | null
    depth: number
    body: string
  }): Promise<DocumentCommentRecord> {
    const comment = await this.prisma.client.documentComment.create({
      data: {
        documentId: input.documentId,
        blockId: input.blockId,
        anchorFrom: input.anchorFrom ?? null,
        anchorTo: input.anchorTo ?? null,
        userId: input.userId,
        parentId: input.parentId,
        depth: input.depth,
        body: input.body,
      },
      include: { user: { select: { displayName: true, color: true } } },
    })
    return this.toRecord(comment)
  }

  async deleteById(commentId: string): Promise<void> {
    await this.prisma.client.documentComment.delete({
      where: { id: commentId },
    })
  }
}

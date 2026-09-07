import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { DocumentsService } from "../documents/documents.service"
import {
  MAX_DOCUMENT_COMMENT_BODY_LENGTH,
  MAX_DOCUMENT_COMMENT_DEPTH,
  type DocumentCommentNode,
  type DocumentCommentRecord,
} from "./document-comment-types"
import { DocumentCommentsRepository } from "./document-comments.repository"

@Injectable()
export class DocumentCommentsService {
  constructor(
    @Inject(DocumentCommentsRepository)
    private readonly comments: DocumentCommentsRepository,
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  async listComments(
    documentId: string,
    userId: string,
    blockId?: string
  ): Promise<DocumentCommentNode[]> {
    await this.documents.assertCanRead(documentId, userId)
    const flat = await this.comments.listForDocument(documentId, blockId)
    return buildCommentTree(flat)
  }

  async createComment(
    documentId: string,
    userId: string,
    input: {
      body?: string
      blockId?: string
      anchorFrom?: number
      anchorTo?: number
      parentId?: string
    }
  ): Promise<DocumentCommentRecord> {
    await this.documents.assertCanRead(documentId, userId)

    const blockId = (input.blockId ?? "").trim()
    if (!input.parentId && !blockId) {
      throw new BadRequestException("blockId is required")
    }

    const body = (input.body ?? "").trim()
    if (!body) {
      throw new BadRequestException("评论内容不能为空")
    }
    if (body.length > MAX_DOCUMENT_COMMENT_BODY_LENGTH) {
      throw new BadRequestException(
        `评论内容不能超过 ${MAX_DOCUMENT_COMMENT_BODY_LENGTH} 个字符`
      )
    }

    let parentId: string | null = null
    let depth = 0
    let anchorBlockId = blockId
    let anchorFrom: number | null = input.anchorFrom ?? null
    let anchorTo: number | null = input.anchorTo ?? null

    if (input.parentId) {
      const parent = await this.comments.findById(input.parentId)
      if (!parent || parent.documentId !== documentId) {
        throw new BadRequestException("回复目标不存在")
      }
      if (parent.depth >= MAX_DOCUMENT_COMMENT_DEPTH) {
        throw new BadRequestException("回复层级已达上限")
      }
      parentId = parent.id
      depth = parent.depth + 1
      anchorBlockId = parent.blockId
      anchorFrom = parent.anchorFrom
      anchorTo = parent.anchorTo
    } else if (
      anchorFrom == null ||
      anchorTo == null ||
      anchorFrom >= anchorTo
    ) {
      throw new BadRequestException("请选中要评论的文字")
    }

    return this.comments.create({
      documentId,
      blockId: anchorBlockId,
      anchorFrom,
      anchorTo,
      userId,
      parentId,
      depth,
      body,
    })
  }

  async deleteComment(
    documentId: string,
    commentId: string,
    userId: string
  ): Promise<void> {
    await this.documents.assertCanRead(documentId, userId)

    const comment = await this.comments.findById(commentId)
    if (!comment || comment.documentId !== documentId) {
      throw new NotFoundException("评论不存在")
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException("只能删除自己的评论")
    }

    await this.comments.deleteById(commentId)
  }
}

function buildCommentTree(
  comments: DocumentCommentRecord[]
): DocumentCommentNode[] {
  const nodes = new Map<string, DocumentCommentNode>()
  const roots: DocumentCommentNode[] = []

  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] })
  }

  for (const comment of comments) {
    const node = nodes.get(comment.id)
    if (!node) continue

    if (comment.parentId) {
      const parent = nodes.get(comment.parentId)
      if (parent) {
        parent.replies.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  return roots
}

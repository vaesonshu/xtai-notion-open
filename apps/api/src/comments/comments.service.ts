import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import {
  MAX_COMMENT_BODY_LENGTH,
  MAX_COMMENT_DEPTH,
  type ArticleCommentNode,
  type ArticleCommentRecord,
} from "./comment-types"
import { CommentsRepository } from "./comments.repository"

@Injectable()
export class CommentsService {
  constructor(
    @Inject(CommentsRepository) private readonly comments: CommentsRepository
  ) {}

  async listComments(articleId: string): Promise<ArticleCommentNode[]> {
    if (!(await this.comments.isPublishedArticle(articleId))) {
      throw new NotFoundException("Article not found")
    }
    const flat = await this.comments.listForArticle(articleId)
    return buildCommentTree(flat)
  }

  async createComment(
    articleId: string,
    userId: string,
    input: { body?: string; parentId?: string }
  ): Promise<ArticleCommentRecord> {
    if (!(await this.comments.isPublishedArticle(articleId))) {
      throw new NotFoundException("Article not found")
    }

    const body = (input.body ?? "").trim()
    if (!body) {
      throw new BadRequestException("评论内容不能为空")
    }
    if (body.length > MAX_COMMENT_BODY_LENGTH) {
      throw new BadRequestException(
        `评论内容不能超过 ${MAX_COMMENT_BODY_LENGTH} 个字符`
      )
    }

    let parentId: string | null = null
    let depth = 0

    if (input.parentId) {
      const parent = await this.comments.findById(input.parentId)
      if (!parent || parent.articleId !== articleId) {
        throw new BadRequestException("回复目标不存在")
      }
      if (parent.depth >= MAX_COMMENT_DEPTH) {
        throw new BadRequestException("回复层级已达上限")
      }
      parentId = parent.id
      depth = parent.depth + 1
    }

    return this.comments.create({
      articleId,
      userId,
      parentId,
      depth,
      body,
    })
  }
}

function buildCommentTree(
  comments: ArticleCommentRecord[]
): ArticleCommentNode[] {
  const nodes = new Map<string, ArticleCommentNode>()
  const roots: ArticleCommentNode[] = []

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

/** 单条评论在 API 中的扁平形状（含作者展示字段）。 */
export interface ArticleCommentRecord {
  id: string
  articleId: string
  parentId: string | null
  depth: number
  body: string
  authorId: string
  authorName: string
  authorColor: string
  createdAt: Date
}

/** 嵌套树节点，供广场阅读页递归渲染多级回复。 */
export interface ArticleCommentNode {
  id: string
  articleId: string
  parentId: string | null
  depth: number
  body: string
  authorId: string
  authorName: string
  authorColor: string
  createdAt: Date
  replies: ArticleCommentNode[]
}

export const MAX_COMMENT_DEPTH = 3
export const MAX_COMMENT_BODY_LENGTH = 2000

/** 文档内块级评论的扁平记录（含作者展示字段）。 */
export interface DocumentCommentRecord {
  id: string
  documentId: string
  blockId: string
  parentId: string | null
  depth: number
  body: string
  authorId: string
  authorName: string
  authorColor: string
  createdAt: Date
}

/** 嵌套树节点，供侧栏按块分组后递归渲染回复。 */
export interface DocumentCommentNode {
  id: string
  documentId: string
  blockId: string
  parentId: string | null
  depth: number
  body: string
  authorId: string
  authorName: string
  authorColor: string
  createdAt: Date
  replies: DocumentCommentNode[]
}

export const MAX_DOCUMENT_COMMENT_DEPTH = 3
export const MAX_DOCUMENT_COMMENT_BODY_LENGTH = 2000

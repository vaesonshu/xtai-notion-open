import type { Block } from "@workspace/editor-core"

export type DocumentRole = "owner" | "editor" | "viewer"
export type PublicationStatus = "draft" | "pending" | "published"

export const DOCUMENT_ROLES: readonly DocumentRole[] = [
  "owner",
  "editor",
  "viewer",
] as const

export function isDocumentRole(value: unknown): value is DocumentRole {
  return value === "owner" || value === "editor" || value === "viewer"
}

export interface DocumentRow {
  id: string
  workspace_id: string
  parent_id?: string | null
  depth?: number
  title: string
  created_at: Date
  updated_at: Date
  publication_status?: PublicationStatus
  rejection_reason?: string | null
  published_at?: Date | null
  published_by?: string | null
}

export interface DocumentListRow extends DocumentRow {
  role: DocumentRole
}

export interface DocumentMetadata {
  id: string
  workspaceId: string
  parentId: string | null
  depth: number
  title: string
  role: DocumentRole
  createdAt: Date
  updatedAt: Date
  publicationStatus: PublicationStatus
  rejectionReason: string | null
  publishedAt: Date | null
  publishedBy: string | null
}

export interface PublicationMetadata extends DocumentMetadata {
  author: string | null
}

export interface PublishedArticle {
  id: string
  title: string
  author: string | null
  authorColor: string | null
  publishedAt: Date
  excerpt: string
  category: string
}

export interface PublishedArticleDetail extends PublishedArticle {
  content: Block[]
}

export interface PublishedArticleSource {
  row: DocumentRow
  authorName: string | null
  authorColor: string | null
  workspaceName: string
}

/** 文档图谱节点：links 为文档内 @mention 引用的其他文档 id。 */
export interface DocumentGraphNode {
  id: string
  title: string
  links: string[]
}

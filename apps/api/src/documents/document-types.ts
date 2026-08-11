export type DocumentRole = "owner" | "editor" | "viewer"

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
}

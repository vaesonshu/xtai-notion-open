import type { WorkspaceAiSettings } from "./workspace-ai.types"

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer"

export type WorkspaceVisibility = "private" | "public"

export function isWorkspaceVisibility(
  value: unknown
): value is WorkspaceVisibility {
  return value === "private" || value === "public"
}

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  "owner",
  "admin",
  "editor",
  "viewer",
] as const

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "editor" ||
    value === "viewer"
  )
}

export interface WorkspaceRow {
  id: string
  name: string
  slug: string | null
  visibility: WorkspaceVisibility
  settings: unknown
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PublicWorkspaceView {
  id: string
  name: string
  slug: string | null
  visibility: "public"
  publishedDocumentCount: number
}

export interface PublicWorkspaceDocumentSummary {
  id: string
  title: string
  publishedAt: string
}

export interface WorkspaceListRow extends WorkspaceRow {
  role: WorkspaceRole
  memberCount: number
  documentCount: number
}

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string | null
  visibility: WorkspaceVisibility
  memberCount: number
  documentCount: number
  role: WorkspaceRole
  aiSettings: WorkspaceAiSettings
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceMemberView {
  userId: string
  email: string
  displayName: string
  color: string
  role: WorkspaceRole
}

export interface WorkspaceInviteCandidate {
  userId: string
  email: string
  displayName: string
  color: string
}

/** 库级角色映射到现有文档三档角色，供 DocumentsService 复用。 */
export function mapWorkspaceRoleToDocumentRole(
  role: WorkspaceRole
): "owner" | "editor" | "viewer" {
  if (role === "owner") return "owner"
  if (role === "viewer") return "viewer"
  return "editor"
}

const ROLE_PRIORITY: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

export function pickHigherWorkspaceRole(
  current: WorkspaceRole | null,
  next: WorkspaceRole
): WorkspaceRole {
  if (!current) return next
  return ROLE_PRIORITY[next] > ROLE_PRIORITY[current] ? next : current
}

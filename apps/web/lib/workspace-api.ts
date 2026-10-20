import { apiRequest, apiRequestJson, readApiErrorMessage } from "@/lib/api-client"
import type { WorkspaceAiSettings } from "@/lib/article-agent-types"

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer"

export type WorkspaceVisibility = "private" | "public"

export type WorkspaceSummary = {
  id: string
  name: string
  visibility: WorkspaceVisibility
  memberCount: number
  documentCount: number
  role: WorkspaceRole
  aiSettings: WorkspaceAiSettings
  createdAt: string
  updatedAt: string
}

export const WORKSPACE_VISIBILITY_LABELS: Record<WorkspaceVisibility, string> = {
  private: "私有",
  public: "公开",
}

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "所有者",
  admin: "管理员",
  editor: "编辑者",
  viewer: "查看者",
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin"
}

export async function fetchWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  return apiRequestJson<WorkspaceSummary[]>({
    path: "/workspaces",
    userId,
  })
}

export async function fetchWorkspace(
  workspaceId: string,
  userId: string
): Promise<WorkspaceSummary> {
  return apiRequestJson<WorkspaceSummary>({
    path: `/workspaces/${workspaceId}`,
    userId,
  })
}

export async function createWorkspace(
  userId: string,
  name: string
): Promise<WorkspaceSummary> {
  return apiRequestJson<WorkspaceSummary>({
    path: "/workspaces",
    method: "POST",
    userId,
    json: { name },
  })
}

export async function renameWorkspace(
  workspaceId: string,
  userId: string,
  name: string
): Promise<WorkspaceSummary> {
  return apiRequestJson<WorkspaceSummary>({
    path: `/workspaces/${workspaceId}`,
    method: "PATCH",
    userId,
    json: { name },
  })
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  userId: string,
  patch: { name?: string; visibility?: WorkspaceVisibility }
): Promise<WorkspaceSummary> {
  return apiRequestJson<WorkspaceSummary>({
    path: `/workspaces/${workspaceId}`,
    method: "PATCH",
    userId,
    json: patch,
  })
}

export async function fetchWorkspaceAiSettings(
  workspaceId: string,
  userId: string
): Promise<WorkspaceAiSettings> {
  return apiRequestJson<WorkspaceAiSettings>({
    path: `/workspaces/${workspaceId}/ai-settings`,
    userId,
  })
}

export async function updateWorkspaceAiSettings(
  workspaceId: string,
  userId: string,
  patch: Partial<WorkspaceAiSettings>
): Promise<WorkspaceAiSettings> {
  return apiRequestJson<WorkspaceAiSettings>({
    path: `/workspaces/${workspaceId}/ai-settings`,
    method: "PATCH",
    userId,
    json: patch,
  })
}

export async function importMarkdownToWorkspace(
  workspaceId: string,
  userId: string,
  input: { title: string; markdown: string }
): Promise<{ id: string; title: string }> {
  return apiRequestJson<{ id: string; title: string }>({
    path: `/workspaces/${workspaceId}/documents/import-markdown`,
    method: "POST",
    userId,
    json: input,
  })
}

export async function renameWorkspaceSafe(
  workspaceId: string,
  userId: string,
  name: string
): Promise<WorkspaceSummary | null> {
  const response = await apiRequest({
    path: `/workspaces/${workspaceId}`,
    method: "PATCH",
    userId,
    json: { name },
  })
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "重命名失败"))
  }
  return response.json() as Promise<WorkspaceSummary>
}

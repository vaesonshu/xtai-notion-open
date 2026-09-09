import { apiRequest, apiRequestJson, readApiErrorMessage } from "@/lib/api-client"

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer"

export type WorkspaceSummary = {
  id: string
  name: string
  memberCount: number
  documentCount: number
  role: WorkspaceRole
  createdAt: string
  updatedAt: string
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

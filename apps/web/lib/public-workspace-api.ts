import { apiRequestJson } from "@/lib/api-client"

export type PublicWorkspaceView = {
  id: string
  name: string
  visibility: "public"
  publishedDocumentCount: number
}

export type PublicWorkspaceDocumentSummary = {
  id: string
  title: string
  publishedAt: string
}

export async function fetchPublicWorkspace(
  workspaceId: string
): Promise<PublicWorkspaceView> {
  return apiRequestJson<PublicWorkspaceView>({
    path: `/public/workspaces/${workspaceId}`,
  })
}

export async function fetchPublicWorkspaceDocuments(
  workspaceId: string
): Promise<PublicWorkspaceDocumentSummary[]> {
  return apiRequestJson<PublicWorkspaceDocumentSummary[]>({
    path: `/public/workspaces/${workspaceId}/documents`,
  })
}

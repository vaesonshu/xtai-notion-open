import { apiRequestJson } from "@/lib/api-client"

export type PublicWorkspaceView = {
  id: string
  name: string
  slug: string | null
  visibility: "public"
  publishedDocumentCount: number
}

export type PublicWorkspaceDocumentSummary = {
  id: string
  title: string
  publishedAt: string
}

export async function fetchPublicWorkspace(
  workspaceKey: string
): Promise<PublicWorkspaceView> {
  return apiRequestJson<PublicWorkspaceView>({
    path: `/public/workspaces/${encodeURIComponent(workspaceKey)}`,
  })
}

export async function fetchPublicWorkspaceDocuments(
  workspaceKey: string
): Promise<PublicWorkspaceDocumentSummary[]> {
  return apiRequestJson<PublicWorkspaceDocumentSummary[]>({
    path: `/public/workspaces/${encodeURIComponent(workspaceKey)}/documents`,
  })
}

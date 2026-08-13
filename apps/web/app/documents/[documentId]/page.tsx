"use client"

import { useParams } from "next/navigation"
import { useAuth } from "../../../components/auth-provider"
import { WorkspaceShell } from "../../../components/inkspace/workspace-shell"

export default function DocumentPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const { user, loading } = useAuth()

  if (loading || !user) return null

  // The dynamic route owns the workspace so each URL renders its own document.
  return (
    <WorkspaceShell
      documentId={documentId}
      user={{ ...user, color: user.color ?? "#24866B" }}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
      collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
    />
  )
}

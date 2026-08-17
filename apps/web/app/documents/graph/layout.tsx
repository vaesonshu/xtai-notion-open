"use client"

import { useAuth } from "../../../components/auth-provider"
import { DocumentGraph } from "../../../components/inkspace/document-graph/document-graph"
import { WorkspaceShell } from "../../../components/inkspace/workspace-shell"

export default function DocumentGraphLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()

  if (!user) return null

  return (
    <WorkspaceShell
      user={{ ...user, color: user.color ?? "#24866B" }}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
      collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
      activeNav="graph"
    >
      <DocumentGraph
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
        userId={user.id}
      />
      {children}
    </WorkspaceShell>
  )
}

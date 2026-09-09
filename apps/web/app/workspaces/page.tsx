"use client"

import { useAuth } from "../../components/auth-provider"
import { WorkspaceListPage } from "../../components/inkspace/workspace-list-page"

export default function WorkspacesPage() {
  const { user } = useAuth()
  if (!user) return null
  return <WorkspaceListPage userId={user.id} />
}

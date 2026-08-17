"use client"

import { useParams } from "next/navigation"
import { useAuth } from "../../../components/auth-provider"
import { WorkspaceShell } from "../../../components/inkspace/workspace-shell"

// 工作区壳层放在 layout，切换 /documents/:id 时组件不卸载，侧边栏列表保持稳定。
export default function DocumentWorkspaceLayout() {
  const { documentId } = useParams<{ documentId: string }>()
  const { user } = useAuth()

  if (!documentId || !user) return null

  return (
    <WorkspaceShell
      documentId={documentId}
      user={{ ...user, color: user.color ?? "#24866B" }}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
      collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
    />
  )
}

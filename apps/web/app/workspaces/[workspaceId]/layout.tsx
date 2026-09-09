"use client"

import { useParams, useRouter } from "next/navigation"
import { useAuth } from "../../../components/auth-provider"
import { WorkspaceShell } from "../../../components/inkspace/workspace-shell"

export default function WorkspaceDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const { user } = useAuth()

  if (!workspaceId || !user) return null

  return (
    <div
      data-pencil-page
      className="flex h-svh min-h-0 w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      <WorkspaceShell
        initialWorkspaceId={workspaceId}
        showWorkspaceHome
        user={{ ...user, color: user.color ?? "#24866B" }}
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
        collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
        activeNav="workspaces"
        onOpenWorkspaces={() => router.push("/workspaces")}
        onWorkspaceSwitch={(id) => router.push(`/workspaces/${id}`)}
      />
      {children}
    </div>
  )
}

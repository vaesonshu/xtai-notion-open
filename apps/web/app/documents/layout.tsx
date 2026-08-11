"use client"

import { useParams } from "next/navigation"
import { WorkspaceShell } from "../../components/inkspace/workspace-shell"

const DEMO_USER = {
  id: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "demo-owner",
  name: "林",
  color: "#E64B3C",
} as const

export default function DocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const params = useParams<{ documentId?: string }>()
  const documentId = params.documentId

  return (
    <div
      data-pencil-page
      className="flex min-h-svh w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      {documentId ? (
        <WorkspaceShell
          documentId={documentId}
          user={DEMO_USER}
          apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
          collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
        />
      ) : null}
      {children}
    </div>
  )
}

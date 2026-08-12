"use client"

import { useParams } from "next/navigation"
import { Spinner } from "@workspace/ui/components/spinner"
import { useAuth } from "../../components/auth-provider"
import { WorkspaceShell } from "../../components/inkspace/workspace-shell"

export default function DocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const params = useParams<{ documentId?: string }>()
  const documentId = params.documentId
  const { user, loading } = useAuth()

  if (loading) {
    // Do not initialize the editor with a fallback identity while the session
    // lookup is in flight, or its metadata request can be rejected as a user
    // who does not own the newly created document.
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#F8F8F6]">
        <Spinner />
      </div>
    )
  }

  const editorUser = user
    ? {
        ...user,
        // The editor's collaboration presence requires a concrete color while
        // the authentication endpoint treats it as an optional profile field.
        color: user.color ?? "#24866B",
      }
    : null

  return (
    <div
      data-pencil-page
      className="flex min-h-svh w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      {documentId && editorUser ? (
        <WorkspaceShell
          documentId={documentId}
          user={editorUser}
          apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
          collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
        />
      ) : null}
      {children}
    </div>
  )
}

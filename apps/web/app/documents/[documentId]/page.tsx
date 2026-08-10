import { WorkspaceShell } from "../../../components/inkspace/workspace-shell"

const DEMO_USER = {
  id: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "demo-owner",
  name: "林",
  color: "#E64B3C",
} as const

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params

  return (
    <div
      data-pencil-page
      className="flex min-h-svh w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      <WorkspaceShell
        documentId={documentId}
        user={DEMO_USER}
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
        collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
      />
    </div>
  )
}

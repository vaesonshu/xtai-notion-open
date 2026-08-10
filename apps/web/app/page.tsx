import { DEMO_DOCUMENT_ID } from "@/components/inkspace/document"
import { WorkspaceShell } from "@/components/inkspace/workspace-shell"

const DEMO_USER = {
  id: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "",
  name: "林",
  color: "#E64B3C",
} as const

export default function Page() {
  return (
    <div
      data-pencil-page
      className="flex min-h-svh w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      <WorkspaceShell
        documentId={DEMO_DOCUMENT_ID}
        user={{
          id: DEMO_USER.id || "demo-owner",
          name: DEMO_USER.name,
          color: DEMO_USER.color,
        }}
        apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ""}
        collaborationUrl={process.env.NEXT_PUBLIC_COLLABORATION_URL ?? ""}
      />
    </div>
  )
}

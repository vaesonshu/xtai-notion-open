import { AuthMenu } from "@/components/auth-menu"
import { DEMO_DOCUMENT_ID } from "@/components/inkspace/document"
import { WorkspaceShell } from "@/components/inkspace/workspace-shell"

const DEMO_USER = {
  id: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "",
  name: "林",
  color: "#E64B3C",
} as const

export default function Page() {
  return (
    // make container relative so the floating login link can position itself
    <div
      data-pencil-page
      className="relative flex min-h-svh w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      <div className="absolute top-4 right-4">
        <AuthMenu />
      </div>

      <WorkspaceShell
        documentId={DEMO_DOCUMENT_ID}
        openFirstDocument
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

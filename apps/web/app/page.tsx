import { DocumentCanvas } from "@/components/inkspace/document"
import { EditorToolbar } from "@/components/inkspace/toolbar"
import { WorkspaceSidebar } from "@/components/inkspace/sidebar"

export default function Page() {
  return (
    <div
      data-pencil-page
      className="flex min-h-svh w-full overflow-hidden bg-[#F8F8F6] !text-[#242321]"
    >
      <WorkspaceSidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-[#FCFCFA] !text-[#242321]">
        <EditorToolbar />
        <DocumentCanvas />
      </main>
    </div>
  )
}

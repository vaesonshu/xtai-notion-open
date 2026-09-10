import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EditorToolbar } from "@/components/inkspace/toolbar"

vi.mock("@xtai-notion/editor-react", () => ({
  // Keep collaboration deterministic while exercising the real toolbar DOM.
  useCollaborationStatus: () => "synced",
  useCollaborators: () => [{ id: "user-2", name: "Lin", color: "#24866B" }],
}))

vi.mock("@/components/auth-menu", () => ({ AuthMenu: () => null }))
vi.mock("@/components/inkspace/share-dialog", () => ({
  ShareDialog: () => null,
}))

describe("EditorToolbar", () => {
  it("shows AI assistant and agent toolbar buttons", () => {
    const onAiAssistantToggle = vi.fn()
    const onAiAgentToggle = vi.fn()
    const { getByRole } = render(
      <EditorToolbar
        onAiAssistantToggle={onAiAssistantToggle}
        onAiAgentToggle={onAiAgentToggle}
        agentUsesLocalCodex
      />
    )

    expect(getByRole("button", { name: "AI 协作助手" })).toHaveTextContent("AI")
    expect(getByRole("button", { name: "AI 智能体" })).toHaveTextContent(
      "Codex"
    )
    fireEvent.click(getByRole("button", { name: "AI 智能体" }))
    expect(onAiAgentToggle).toHaveBeenCalledOnce()
  })

  it("does not nest buttons when collaborator avatars are visible", () => {
    const { container } = render(<EditorToolbar />)

    expect(container.querySelector("button button")).toBeNull()
  })

  it("shows a disabled pending approval action", () => {
    const { getByRole } = render(<EditorToolbar publicationStatus="pending" />)

    expect(getByRole("button", { name: "待审批" })).toBeDisabled()
  })

  it("uses distinct publish button colors for each publication status", () => {
    const { getByRole, rerender } = render(
      <EditorToolbar publicationStatus="draft" onPublish={() => undefined} />
    )

    expect(getByRole("button", { name: "发布" })).toHaveClass("!bg-[#E64B3C]")

    rerender(<EditorToolbar publicationStatus="pending" />)
    expect(getByRole("button", { name: "待审批" })).toHaveClass("!bg-[#D97706]")

    rerender(<EditorToolbar publicationStatus="published" />)
    expect(getByRole("button", { name: "已发布" })).toHaveClass("!bg-[#24866B]")
  })

  it("submits a draft publication through the toolbar callback", () => {
    const onPublish = vi.fn()
    const { getByRole } = render(
      <EditorToolbar publicationStatus="draft" onPublish={onPublish} />
    )

    fireEvent.click(getByRole("button", { name: "发布" }))
    expect(onPublish).toHaveBeenCalledOnce()
  })

  it("renders import next to share when onImportMarkdown is provided", () => {
    const onImportMarkdown = vi.fn()
    const { getByRole } = render(
      <EditorToolbar
        apiUrl="http://127.0.0.1:3100"
        documentId="doc-1"
        onImportMarkdown={onImportMarkdown}
      />
    )

    fireEvent.click(getByRole("button", { name: "导入" }))
    expect(onImportMarkdown).toHaveBeenCalledOnce()
  })

  it("shows importing state and disables the import button while busy", () => {
    const { getByRole } = render(
      <EditorToolbar onImportMarkdown={vi.fn()} importingMarkdown />
    )

    const button = getByRole("button", { name: "导入中…" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
  })
})

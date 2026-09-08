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
  it("shows a clearly labeled AI assistant button", () => {
    const { getByRole } = render(<EditorToolbar />)

    expect(getByRole("button", { name: "AI 协作助手" })).toHaveTextContent("AI")
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
})

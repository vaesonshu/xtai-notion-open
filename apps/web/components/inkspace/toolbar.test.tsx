import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EditorToolbar } from "./toolbar"

vi.mock("@workspace/editor/react", () => ({
  // Keep collaboration deterministic while exercising the real toolbar DOM.
  useCollaborationStatus: () => "synced",
  useCollaborators: () => [{ id: "user-2", name: "Lin", color: "#24866B" }],
}))

vi.mock("../auth-menu", () => ({ AuthMenu: () => null }))
vi.mock("./share-dialog", () => ({ ShareDialog: () => null }))

describe("EditorToolbar", () => {
  it("does not nest buttons when collaborator avatars are visible", () => {
    const { container } = render(<EditorToolbar />)

    expect(container.querySelector("button button")).toBeNull()
  })
})

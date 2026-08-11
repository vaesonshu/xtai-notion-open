import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EditorProvider } from "@workspace/editor/react"
import { FixedEditorToolbar, insertEmoji } from "./fixed-toolbar"

describe("FixedEditorToolbar", () => {
  it("renders the core formatting controls", () => {
    render(
      <EditorProvider>
        <FixedEditorToolbar />
      </EditorProvider>
    )

    expect(screen.getByRole("toolbar")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument()
  })

  it("inserts the selected emoji at the current cursor position", () => {
    const run = vi.fn(() => true)
    const insertContent = vi.fn(() => ({ run }))
    const focus = vi.fn(() => ({ insertContent }))
    const editor = { chain: () => ({ focus }) }

    insertEmoji(editor as never, "😀")

    expect(insertContent).toHaveBeenCalledWith("😀")
    expect(run).toHaveBeenCalledOnce()
  })
})

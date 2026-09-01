import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EditorProvider } from "@xtai-notion/editor-react"
import { FixedEditorToolbar, insertEmoji } from "@/components/inkspace/fixed-toolbar"

vi.mock("@emoji-mart/data", () => ({ default: {} }))
let selectEmoji: ((emoji: { native?: string }) => void) | undefined

vi.mock("emoji-mart", () => ({
  Picker: class MockPicker {
    constructor(options: {
      onEmojiSelect: (emoji: { native?: string }) => void
    }) {
      selectEmoji = options.onEmojiSelect
      const element = document.createElement("div")
      element.setAttribute("data-testid", "emoji-picker")
      return element
    }
  },
}))

describe("FixedEditorToolbar", () => {
  it("renders the core formatting controls", () => {
    render(
      <EditorProvider>
        <FixedEditorToolbar />
      </EditorProvider>
    )

    expect(screen.getByRole("toolbar")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "粗体" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "文字颜色" })).toBeInTheDocument()
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

  it("shows a loading state before constructing the emoji picker", async () => {
    render(
      <EditorProvider>
        <FixedEditorToolbar />
      </EditorProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }))

    expect(screen.getByText("Loading emoji picker…")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId("emoji-picker")).toBeInTheDocument()
    )
    expect(screen.queryByText("Loading emoji picker…")).not.toBeInTheDocument()
  })

  it("hides the toolbar for viewers without edit permission", async () => {
    render(
      <EditorProvider editable={false}>
        <FixedEditorToolbar />
      </EditorProvider>
    )

    await waitFor(() => {
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument()
    })
  })

  it("closes the picker after selecting an emoji", async () => {
    selectEmoji = undefined

    render(
      <EditorProvider>
        <FixedEditorToolbar />
      </EditorProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }))
    await waitFor(() => expect(selectEmoji).toBeDefined())

    await act(async () => {
      selectEmoji?.({ native: "😀" })
    })

    await waitFor(() =>
      expect(screen.queryByTestId("emoji-picker")).not.toBeInTheDocument()
    )
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EditorProvider } from "./editor-provider.js"
import { useEditorInstance } from "./use-editor-instance.js"

function EditorName() {
  const editor = useEditorInstance()
  return <span>{editor.options.editable ? "editable" : "readonly"}</span>
}

function InsertContentButton() {
  const editor = useEditorInstance()
  return <button onClick={() => editor.commands.insertContent("新内容")}>insert</button>
}

describe("EditorProvider", () => {
  it("provides an editable editor instance to descendants", () => {
    render(<EditorProvider><EditorName /></EditorProvider>)

    expect(screen.getByText("editable")).toBeInTheDocument()
  })

  it("emits the latest JSON document after an edit", () => {
    const onChange = vi.fn()
    render(<EditorProvider onChange={onChange}><InsertContentButton /></EditorProvider>)
    screen.getByRole("button", { name: "insert" }).click()

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "doc" }))
  })
})

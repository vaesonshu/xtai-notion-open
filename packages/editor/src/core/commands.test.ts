import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import { createEditorExtensions } from "./extensions.js"
import { setEditorLink, toggleInlineMark } from "./commands.js"

const editors: Editor[] = []

function createTestEditor(): Editor {
  const editor = new Editor({
    extensions: createEditorExtensions(),
    content: "<p>format this text</p>",
  })

  editors.push(editor)
  editor.commands.setTextSelection({ from: 1, to: 7 })
  return editor
}

afterEach(() => {
  for (const editor of editors) {
    editor.destroy()
  }
  editors.length = 0
})

describe("toggleInlineMark", () => {
  it("toggles the requested inline mark through Tiptap's editor command chain", () => {
    const editor = createTestEditor()

    expect(toggleInlineMark(editor, "bold")).toBe(true)
    expect(editor.isActive("bold")).toBe(true)

    expect(toggleInlineMark(editor, "bold")).toBe(true)
    expect(editor.isActive("bold")).toBe(false)
  })
})

describe("setEditorLink", () => {
  it("sets the href on the current text selection through Tiptap's link command", () => {
    const editor = createTestEditor()

    expect(setEditorLink(editor, "https://example.com/docs")).toBe(true)
    expect(editor.isActive("link", { href: "https://example.com/docs" })).toBe(true)
    expect(editor.getJSON()).toMatchObject({
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          marks: [{ type: "link", attrs: { href: "https://example.com/docs" } }],
        }],
      }],
    })
  })

  it("removes the link when href is empty", () => {
    const editor = createTestEditor()
    setEditorLink(editor, "https://example.com/docs")

    expect(setEditorLink(editor, "")).toBe(true)
    expect(editor.isActive("link")).toBe(false)
  })
})

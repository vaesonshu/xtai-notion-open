import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"
import { createBlockSchemaExtensions } from "@core/extensions"
import {
  normalizeTextColorInput,
  setTextColor,
  unsetTextColor,
} from "@core/commands"

const editors: Editor[] = []

function createEditor() {
  const editor = new Editor({
    extensions: createBlockSchemaExtensions(),
    content: "<p>hello</p>",
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) {
    editor.destroy()
  }
  editors.length = 0
})

describe("text color commands", () => {
  it("normalizes shorthand and full hex colors", () => {
    expect(normalizeTextColorInput("#abc")).toBe("#AABBCC")
    expect(normalizeTextColorInput("24866B")).toBe("#24866B")
    expect(normalizeTextColorInput("not-a-color")).toBeNull()
  })

  it("sets and unsets text color on the current selection", () => {
    const editor = createEditor()
    editor.commands.selectAll()

    expect(setTextColor(editor, "#24866B")).toBe(true)
    expect(editor.getAttributes("textStyle").color).toBe("#24866B")

    expect(unsetTextColor(editor)).toBe(true)
    expect(editor.getAttributes("textStyle").color).toBeUndefined()
  })
})

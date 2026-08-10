import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import { createEditorExtensions } from "./extensions.js"
import {
  executeSlashCommand,
  filterSlashCommands,
  SLASH_COMMANDS,
} from "./slash-commands.js"

const editors: Editor[] = []

function createTestEditor(): Editor {
  const editor = new Editor({
    extensions: createEditorExtensions(),
    content: "<p>Convert this block</p>",
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

describe("filterSlashCommands", () => {
  it("filters the public command catalog by id, label, and keywords", () => {
    const expectedCodeCommand = expect.objectContaining({ id: "code-block" })

    expect(filterSlashCommands("code-block")).toEqual(expect.arrayContaining([
      expectedCodeCommand,
    ]))
    expect(filterSlashCommands("代码块")).toEqual(expect.arrayContaining([
      expectedCodeCommand,
    ]))
    expect(filterSlashCommands("code")).toEqual(expect.arrayContaining([
      expectedCodeCommand,
    ]))
  })

  it("returns the code block command for the /代码 query", () => {
    expect(filterSlashCommands("/代码")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "code-block" }),
    ]))
  })

  it("returns every public slash command for an empty query", () => {
    expect(filterSlashCommands("")).toEqual(SLASH_COMMANDS)
  })
})

describe("executeSlashCommand", () => {
  it("converts the current block through the editor chain contract", () => {
    const editor = createTestEditor()

    expect(executeSlashCommand(editor, "code-block")).toBe(true)
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: "codeBlock" })
  })

  it("returns false without changing the document for an unknown command", () => {
    const editor = createTestEditor()
    const before = editor.getJSON()

    expect(executeSlashCommand(editor, "not-a-command")).toBe(false)
    expect(editor.getJSON()).toEqual(before)
  })
})

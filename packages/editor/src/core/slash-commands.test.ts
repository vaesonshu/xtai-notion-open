import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import { createEditorExtensions } from "./extensions"
import {
  executeSlashCommand,
  filterCommands,
  filterSlashCommands,
  getSlashCommands,
  SLASH_COMMANDS,
} from "./slash-commands"

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

    expect(filterSlashCommands("code-block")).toEqual(
      expect.arrayContaining([expectedCodeCommand])
    )
    expect(filterSlashCommands("\u4ee3\u7801\u5757")).toEqual(
      expect.arrayContaining([expectedCodeCommand])
    )
    expect(filterSlashCommands("code")).toEqual(
      expect.arrayContaining([expectedCodeCommand])
    )
  })

  it("returns the code block command for the /\u4ee3\u7801 query", () => {
    expect(filterSlashCommands("/\u4ee3\u7801")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "code-block" })])
    )
  })

  it("returns every public slash command for an empty query", () => {
    expect(filterSlashCommands("")).toEqual(SLASH_COMMANDS)
  })

  it("returns every command from a supplied conditional catalog", () => {
    const commands = getSlashCommands({ includeImageUpload: true })

    expect(filterCommands(commands, "")).toEqual(commands)
    expect(filterCommands(commands, "")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "upload-image", label: "上传图片" }),
      ])
    )
  })

  it("exposes only one public command for each supported heading level", () => {
    const headingIds = ["heading-1", "heading-2", "heading-3"]
    expect(SLASH_COMMANDS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "heading-1",
          label: "\u4e00\u7ea7\u6807\u9898",
        }),
        expect.objectContaining({
          id: "heading-2",
          label: "\u4e8c\u7ea7\u6807\u9898",
        }),
        expect.objectContaining({
          id: "heading-3",
          label: "\u4e09\u7ea7\u6807\u9898",
        }),
      ])
    )
    expect(
      SLASH_COMMANDS.filter(({ id }) => id.startsWith("heading")).map(
        ({ id }) => id
      )
    ).toEqual(headingIds)
    expect(filterSlashCommands("\u6807\u9898").map(({ id }) => id)).toEqual(
      headingIds
    )
    expect(filterSlashCommands("heading").map(({ id }) => id)).toEqual(
      headingIds
    )
    expect(filterSlashCommands("h2")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "heading-2" })])
    )
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

  it.each([
    ["heading-2", 2],
    ["heading-3", 3],
  ])("converts the current block to a level %i heading", (id, level) => {
    const editor = createTestEditor()

    expect(executeSlashCommand(editor, id)).toBe(true)
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level },
    })
  })

  it("keeps the legacy heading id as an alias for a level 1 heading", () => {
    const editor = createTestEditor()

    expect(executeSlashCommand(editor, "heading")).toBe(true)
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    })
  })
})

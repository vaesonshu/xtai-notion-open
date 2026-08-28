import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import {
  convertBlockCommand,
  executeSlashCommand,
  filterCommands,
  filterSlashCommands,
  getSlashCommands,
  SLASH_COMMANDS,
} from "@core/slash-commands/index"
import { createEditorSchema } from "@core/schema/create-editor-schema"

const editors: BlockEditor[] = []
const EMPTY_BLOCK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TEXT_BLOCK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function createEmptyBlockEditor(): BlockEditor {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: EMPTY_BLOCK_ID,
        type: "paragraph",
        props: {},
        content: [],
        children: [],
      },
    ],
  })
  editor.tiptap.commands.setTextSelection(3)
  editors.push(editor)
  return editor
}

function createTextBlockEditor(): BlockEditor {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: TEXT_BLOCK_ID,
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "Convert this block", styles: {} }],
        children: [],
      },
    ],
  })
  editor.tiptap.commands.setTextSelection(5)
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

  it("omits canvas slash command when registry excludes canvas", () => {
    const registry = createEditorSchema({ omit: ["canvas"] }).registry
    const commands = getSlashCommands({ registry })
    expect(commands.map((command) => command.id)).not.toContain("canvas-block")
  })
})

describe("executeSlashCommand", () => {
  it("converts an empty block in place", () => {
    const editor = createEmptyBlockEditor()

    expect(executeSlashCommand(editor, "code-block")).toBe(true)
    expect(editor.document[0]?.type).toBe("codeBlock")
    expect(editor.document[0]?.id).toBe(EMPTY_BLOCK_ID)
  })

  it("inserts a new block after a block that already has text", () => {
    const editor = createTextBlockEditor()

    expect(executeSlashCommand(editor, "code-block")).toBe(true)
    expect(editor.document[0]?.type).toBe("paragraph")
    expect(editor.document[1]?.type).toBe("codeBlock")
  })

  it("converts a block with text in place for toolbar commands", () => {
    const editor = createTextBlockEditor()

    expect(convertBlockCommand(editor, "heading-1")).toBe(true)
    expect(editor.document).toHaveLength(1)
    expect(editor.document[0]).toMatchObject({
      id: TEXT_BLOCK_ID,
      type: "heading",
      props: { level: 1 },
    })
    expect(editor.document[0]?.content).toEqual([
      { type: "text", text: "Convert this block", styles: {} },
    ])
  })

  it("returns false without changing the document for an unknown command", () => {
    const editor = createEmptyBlockEditor()
    const before = editor.document

    expect(executeSlashCommand(editor, "not-a-command")).toBe(false)
    expect(editor.document).toEqual(before)
  })

  it.each([
    ["heading-2", 2],
    ["heading-3", 3],
  ])("converts an empty block to a level %i heading", (id, level) => {
    const editor = createEmptyBlockEditor()

    expect(executeSlashCommand(editor, id)).toBe(true)
    expect(editor.document[0]).toMatchObject({
      type: "heading",
      props: { level },
    })
  })

  it("keeps the legacy heading id as an alias for a level 1 heading", () => {
    const editor = createEmptyBlockEditor()

    expect(executeSlashCommand(editor, "heading")).toBe(true)
    expect(editor.document[0]).toMatchObject({
      type: "heading",
      props: { level: 1 },
    })
  })
})

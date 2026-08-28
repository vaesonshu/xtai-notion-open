import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import type { JSONContent } from "@tiptap/core"
import { blocksToPmDoc } from "../block-schema/convert"
import { createEmptyBlocks } from "../block-schema/documents"
import { createEditorExtensions } from "../extensions"
import { setEditorLink, toggleInlineMark } from "./index"

const editors: Editor[] = []

function createTestEditor(): Editor {
  const extensions = createEditorExtensions()
  const schema = new Editor({ extensions }).schema
  const editor = new Editor({
    extensions,
    content: blocksToPmDoc(createEmptyBlocks(), schema).toJSON() as JSONContent,
  })

  // 将空段落替换为带选中文本的块结构
  editor.commands.setContent(
    blocksToPmDoc(
      [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "format this text", styles: {} }],
          children: [],
        },
      ],
      editor.schema
    ).toJSON() as JSONContent
  )

  editors.push(editor)
  editor.commands.setTextSelection({ from: 3, to: 9 })
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
    expect(editor.isActive("link", { href: "https://example.com/docs" })).toBe(
      true
    )

    const blocks = editor.getJSON()
    const paragraph = findNodeByType(blocks, "paragraph")
    expect(paragraph?.content?.[0]).toMatchObject({
      type: "text",
      text: "format",
      marks: [{ type: "link", attrs: { href: "https://example.com/docs" } }],
    })
  })

  it("removes the link when href is empty", () => {
    const editor = createTestEditor()
    setEditorLink(editor, "https://example.com/docs")

    expect(setEditorLink(editor, "")).toBe(true)
    expect(editor.isActive("link")).toBe(false)
  })
})

function findNodeByType(
  node: JSONContent,
  type: string
): JSONContent | undefined {
  if (node.type === type) {
    return node
  }
  for (const child of node.content ?? []) {
    const found = findNodeByType(child, type)
    if (found) {
      return found
    }
  }
  return undefined
}

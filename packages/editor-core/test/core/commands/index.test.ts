import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import type { JSONContent } from "@tiptap/core"
import { blocksToPmDoc } from "@core/api/conversions/pm-doc"
import { createEmptyBlocks } from "@core/model/documents"
import { createEditorExtensions } from "@core/extensions"
import { setEditorLink, toggleInlineMark, normalizeLinkHref } from "@core/commands/index"

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

  it("does not extend strike to text typed after the formatted range", () => {
    const editor = createTestEditor()

    expect(toggleInlineMark(editor, "strike")).toBe(true)

    const insertAt = editor.state.selection.to
    editor.commands.setTextSelection(insertAt)
    editor.chain().focus().insertContent("!").run()
    const marks = editor.state.doc.resolve(insertAt).marks()
    expect(marks.some((mark) => mark.type.name === "strike")).toBe(false)
  })
})

describe("setEditorLink", () => {
  it("normalizes href without protocol before applying the link mark", () => {
    const editor = createTestEditor()

    expect(setEditorLink(editor, "example.com/docs")).toBe(true)
    expect(editor.isActive("link", { href: "https://example.com/docs" })).toBe(
      true
    )
  })

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

  it("does not extend the link mark to text typed after the formatted range", () => {
    const editor = createTestEditor()

    expect(setEditorLink(editor, "https://example.com/docs")).toBe(true)

    const insertAt = editor.state.selection.to
    editor.commands.setTextSelection(insertAt)
    editor.chain().focus().insertContent("!").run()
    expect(
      editor.state.doc
        .resolve(insertAt)
        .marks()
        .some((mark) => mark.type.name === "link")
    ).toBe(false)
  })

  it("removes the link when href is empty", () => {
    const editor = createTestEditor()
    setEditorLink(editor, "https://example.com/docs")

    expect(setEditorLink(editor, "")).toBe(true)
    expect(editor.isActive("link")).toBe(false)
  })
})

describe("normalizeLinkHref", () => {
  it("preserves absolute and relative URLs", () => {
    expect(normalizeLinkHref("https://example.com")).toBe("https://example.com")
    expect(normalizeLinkHref("/documents/doc-1")).toBe("/documents/doc-1")
    expect(normalizeLinkHref("#section")).toBe("#section")
  })

  it("adds https protocol to bare domains", () => {
    expect(normalizeLinkHref("example.com")).toBe("https://example.com")
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

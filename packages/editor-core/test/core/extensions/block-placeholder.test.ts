import { describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import { blocksToPmDoc } from "@core/block-schema/convert"
import { createEditorExtensions } from "@core/extensions/index"
import {
  DEFAULT_PARAGRAPH_PLACEHOLDER,
  resolveBlockPlaceholder,
} from "@core/extensions/block-placeholder"

function createEditorWithBlock(
  block: Parameters<typeof blocksToPmDoc>[0][number]
) {
  const extensions = createEditorExtensions()
  const schema = new Editor({ extensions }).schema
  const editor = new Editor({
    extensions,
    content: blocksToPmDoc([block], schema),
  })

  let contentPos = 0
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === block.type) {
      contentPos = pos
      return false
    }
  })

  const node = editor.state.doc.nodeAt(contentPos)
  if (!node) {
    throw new Error(`Missing block node: ${block.type}`)
  }

  return { editor, node, pos: contentPos }
}

describe("resolveBlockPlaceholder", () => {
  it("uses the default paragraph hint", () => {
    const { editor, node, pos } = createEditorWithBlock({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "paragraph",
      props: {},
      content: [],
      children: [],
    })

    expect(
      resolveBlockPlaceholder({ editor, node, pos })
    ).toBe(DEFAULT_PARAGRAPH_PLACEHOLDER)
  })

  it("uses custom paragraph hint when provided", () => {
    const { editor, node, pos } = createEditorWithBlock({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "paragraph",
      props: {},
      content: [],
      children: [],
    })

    expect(
      resolveBlockPlaceholder({ editor, node, pos }, "协作文档")
    ).toBe("协作文档")
  })

  it.each([
    ["heading", { level: 1 }, "标题 1"],
    ["heading", { level: 2 }, "标题 2"],
    ["heading", { level: 3 }, "标题 3"],
    ["quote", {}, "引用"],
    ["bulletListItem", {}, "列表"],
    ["numberedListItem", {}, "列表"],
    ["checkListItem", { checked: false }, "待办"],
    ["codeBlock", { language: "" }, "输入代码"],
  ] as const)(
    "returns a block-specific hint for %s",
    (type, props, expected) => {
      const { editor, node, pos } = createEditorWithBlock({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type,
        props,
        content: type === "codeBlock" ? [] : [],
        children: [],
      })

      expect(resolveBlockPlaceholder({ editor, node, pos })).toBe(expected)
    }
  )

  it("uses a shorter hint for empty table cells", () => {
    const extensions = createEditorExtensions()
    const schema = new Editor({ extensions }).schema
    const editor = new Editor({
      extensions,
      content: blocksToPmDoc(
        [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            type: "table",
            props: {},
            content: {
              headerRows: 1,
              rows: [{ cells: [{ content: [] }] }],
            },
            children: [],
          },
        ],
        schema
      ),
    })

    let paragraphPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph") {
        paragraphPos = pos
        return false
      }
    })

    const node = editor.state.doc.nodeAt(paragraphPos)
    expect(node?.type.name).toBe("paragraph")
    expect(
      resolveBlockPlaceholder({
        editor,
        node: node!,
        pos: paragraphPos,
      })
    ).toBe("输入内容")
  })
})

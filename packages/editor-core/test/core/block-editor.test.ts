import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import { generateBlockId } from "@core/block-schema/ids"

const editors: BlockEditor[] = []

function create() {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "one", styles: {} }],
        children: [],
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "two", styles: {} }],
        children: [],
      },
    ],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("BlockEditor", () => {
  it("updates block type without dropping id", () => {
    const editor = create()
    editor.updateBlock("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
      type: "heading",
      props: { level: 2 },
    })
    expect(editor.document[0]?.type).toBe("heading")
    expect(editor.document[0]?.id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
  })

  it("nests the current block under the previous sibling", () => {
    const editor = create()
    editor.tiptap.commands.setTextSelection(
      editor.tiptap.state.doc.content.size - 2
    )
    expect(editor.nestBlock()).toBe(true)
    expect(editor.document).toHaveLength(1)
    expect(editor.document[0]?.children[0]?.id).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    )
  })

  it("unnests a child back after its parent", () => {
    const editor = create()
    editor.tiptap.commands.setTextSelection(
      editor.tiptap.state.doc.content.size - 2
    )
    editor.nestBlock()
    expect(editor.unnestBlock()).toBe(true)
    expect(editor.document.map((block) => block.id)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ])
  })

  it("inserts after a ref block", () => {
    const editor = create()
    const id = generateBlockId()
    editor.insertBlocks(
      [
        {
          id,
          type: "paragraph",
          content: [{ type: "text", text: "three", styles: {} }],
        },
      ],
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "after"
    )
    expect(editor.document.map((block) => block.id)[1]).toBe(id)
  })

  it("does not nest past MAX_NEST_DEPTH", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "root0000-0000-4000-8000-000000000001",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "root", styles: {} }],
          children: [],
        },
        {
          id: "root0000-0000-4000-8000-000000000002",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "leaf", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)
    editor.tiptap.commands.setTextSelection(
      editor.tiptap.state.doc.content.size - 2
    )
    for (let depth = 0; depth < 8; depth += 1) {
      expect(editor.nestBlock()).toBe(true)
      editor.tiptap.commands.setTextSelection(
        editor.tiptap.state.doc.content.size - 2
      )
    }
    expect(editor.nestBlock()).toBe(false)
  })
})

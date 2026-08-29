import { describe, expect, it } from "vitest"
import { NodeSelection } from "@tiptap/pm/state"
import { BlockEditor } from "@xtai-notion/editor-core"
import {
  deleteSelectedBlock,
  insertParagraphBelowBlock,
  selectBlockContainer,
} from "@shadcn-src/components/handles/block-side-menu-actions"

const TABLE_BLOCK = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  type: "table" as const,
  props: {},
  content: {
    headerRows: 1,
    rows: [{ cells: [{ content: [] }, { content: [] }] }],
  },
  children: [],
}

const IMAGE_BLOCK = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  type: "image" as const,
  props: { src: null, uploadStatus: "idle" as const },
  children: [],
}

describe("insertParagraphBelowBlock", () => {
  it("inserts an empty paragraph after the current block and focuses it", () => {
    const editor = new BlockEditor({
      initialContent: [TABLE_BLOCK, IMAGE_BLOCK],
    })

    insertParagraphBelowBlock(editor, TABLE_BLOCK.id)

    expect(editor.document).toHaveLength(3)
    expect(editor.document[0]?.type).toBe("table")
    expect(editor.document[1]?.type).toBe("paragraph")
    expect(editor.document[1]?.content).toEqual([])
    expect(editor.document[2]?.type).toBe("image")
    expect(editor.tiptap.state.selection.$from.parent.type.name).toBe(
      "paragraph"
    )

    editor.destroy()
  })

  it("selects the block container on grip click", () => {
    const editor = new BlockEditor({
      initialContent: [TABLE_BLOCK, IMAGE_BLOCK],
    })

    let tablePos = -1
    editor.tiptap.state.doc.descendants((node, pos) => {
      if (node.type.name === "blockContainer" && node.attrs.id === TABLE_BLOCK.id) {
        tablePos = pos
        return false
      }
      return undefined
    })

    selectBlockContainer(editor, tablePos)

    expect(editor.tiptap.state.selection).toBeInstanceOf(NodeSelection)
    expect(
      (editor.tiptap.state.selection as NodeSelection).node.attrs.id
    ).toBe(TABLE_BLOCK.id)

    editor.destroy()
  })

  it("deletes the selected block", () => {
    const editor = new BlockEditor({
      initialContent: [TABLE_BLOCK, IMAGE_BLOCK],
    })

    deleteSelectedBlock(editor, TABLE_BLOCK.id)

    expect(editor.document).toHaveLength(1)
    expect(editor.document[0]?.type).toBe("image")

    editor.destroy()
  })
})

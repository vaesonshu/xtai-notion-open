import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import { applyAiWriteOp, collectAiWriteDraftIds } from "@core/ai-write"

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
    ],
  })
  editors.push(editor)
  return editor
}
afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("applyAiWriteOp", () => {
  it("inserts after ref and records generated ids", () => {
    const editor = create()
    const result = applyAiWriteOp(editor, {
      type: "insert_blocks",
      refId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.op.type).toBe("insert_blocks")
      expect(editor.document).toHaveLength(2)
      expect(editor.document[1]?.content).toEqual([
        { type: "text", text: "two", styles: {} },
      ])
    }
  })

  it("refuses insert when ref id does not exist", () => {
    const editor = create()
    const result = applyAiWriteOp(editor, {
      type: "insert_blocks",
      refId: "missing",
      placement: "after",
      blocks: [{ type: "paragraph", text: "x" }],
    })
    expect(result.ok).toBe(false)
  })
})

describe("collectAiWriteDraftIds", () => {
  it("includes generated insert ids and omits refId", () => {
    const editor = create()
    const refId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const result = applyAiWriteOp(editor, {
      type: "insert_blocks",
      refId,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ids = collectAiWriteDraftIds([result.op])
    expect(ids).not.toContain(refId)
    expect(ids).toEqual([editor.document[1]?.id])
  })

  it("includes update_block ids", () => {
    const updateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    expect(
      collectAiWriteDraftIds([
        { type: "update_block", id: updateId, text: "changed" },
      ])
    ).toEqual([updateId])
  })
})

import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import {
  applyAiWriteOp,
  canReplayAiWriteOps,
  extractDraftBlocks,
} from "@core/ai-write"

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

  it("refuses replay when ref id disappeared", () => {
    const live = create()
    const ops = [
      {
        type: "insert_blocks" as const,
        refId: "missing",
        placement: "after" as const,
        blocks: [{ type: "paragraph" as const, text: "x", id: "x" }],
      },
    ]
    expect(canReplayAiWriteOps(live, ops)).toBe(false)
  })
})

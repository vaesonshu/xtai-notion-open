import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import { createAiWriteStreamApplier } from "@core/ai-write"

const REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const editors: BlockEditor[] = []

function create() {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: REF,
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

function textOf(editor: BlockEditor, index: number) {
  const content = editor.document[index]?.content
  if (!Array.isArray(content)) return ""
  return content.map((part) => ("text" in part ? part.text : "")).join("")
}

describe("createAiWriteStreamApplier", () => {
  it("inserts once then lengthens the same block", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "slash",
      cursorBlockId: REF,
      selectedIds: [],
    })
    const base = {
      type: "tool_partial" as const,
      toolIndex: 0,
      name: "insert_blocks" as const,
    }
    applier.applyPartial({
      ...base,
      args: {
        refId: REF,
        placement: "after",
        blocks: [{ type: "paragraph", text: "he" }],
      },
    })
    applier.applyPartial({
      ...base,
      args: {
        refId: REF,
        placement: "after",
        blocks: [{ type: "paragraph", text: "hello" }],
      },
    })
    expect(editor.document).toHaveLength(2)
    expect(textOf(editor, 1)).toBe("hello")

    const complete = applier.applyComplete(0, {
      type: "insert_blocks",
      refId: REF,
      placement: "after",
      blocks: [{ type: "paragraph", text: "hello world" }],
    })
    expect(complete.ok).toBe(true)
    expect(editor.document).toHaveLength(2)
    expect(textOf(editor, 1)).toBe("hello world")
  })

  it("skips empty trailing insert until text arrives", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "slash",
      cursorBlockId: REF,
      selectedIds: [],
    })
    applier.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "insert_blocks",
      args: {
        refId: REF,
        placement: "after",
        blocks: [{ type: "paragraph", text: "" }],
      },
    })
    expect(editor.document).toHaveLength(1)
    // 空 skip 不得留下 insert 状态，否则 synthesize 会吐空 op
    expect(applier.synthesizeOps()).toEqual([])
  })

  it("applyComplete still uses applyAiWriteOp after empty skip", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "slash",
      cursorBlockId: REF,
      selectedIds: [],
    })
    applier.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "insert_blocks",
      args: {
        refId: REF,
        placement: "after",
        blocks: [{ type: "paragraph", text: "" }],
      },
    })
    // 无 insert 状态时 complete 应走 applyAiWriteOp，允许换成 update
    const result = applier.applyComplete(0, {
      type: "update_block",
      id: REF,
      text: "two",
    })
    expect(result.ok).toBe(true)
    expect(editor.document).toHaveLength(1)
    expect(textOf(editor, 0)).toBe("two")
  })

  it("replaces selection text on first update partial", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "selection",
      cursorBlockId: REF,
      selectedIds: [REF],
    })
    applier.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "update_block",
      args: { id: REF, text: "n" },
    })
    expect(textOf(editor, 0)).toBe("n")
  })

  it("keeps streamed update text when later partial omits text", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "selection",
      cursorBlockId: REF,
      selectedIds: [REF],
    })
    applier.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "update_block",
      args: { id: REF, text: "hello" },
    })
    applier.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "update_block",
      args: { id: REF },
    })
    expect(textOf(editor, 0)).toBe("hello")
  })

  it("applyComplete without partials uses applyAiWriteOp", () => {
    const editor = create()
    const applier = createAiWriteStreamApplier({
      editor,
      mode: "slash",
      cursorBlockId: REF,
      selectedIds: [],
    })
    const result = applier.applyComplete(0, {
      type: "insert_blocks",
      refId: REF,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })
    expect(result.ok).toBe(true)
    expect(editor.document).toHaveLength(2)
  })
})

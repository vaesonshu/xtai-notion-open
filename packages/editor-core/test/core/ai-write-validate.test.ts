import { describe, expect, it } from "vitest"
import {
  blocksToAiBlockViews,
  collectAiBlockIds,
  isEmptyTextBlock,
  validateAiWriteOp,
} from "@core/ai-write"

const para = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  type: "paragraph" as const,
  props: {},
  content: [{ type: "text" as const, text: "hello", styles: {} }],
  children: [],
}

describe("ai-write serialize/validate", () => {
  it("marks image blocks not writable and concatenates text", () => {
    const views = blocksToAiBlockViews([
      para,
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "image",
        props: {},
        children: [],
      },
    ])
    expect(views[0]?.writable).toBe(true)
    expect(views[0]?.text).toBe("hello")
    expect(views[1]?.writable).toBe(false)
  })

  it("rejects nested placement, remove ops, and updating image ids", () => {
    const snapshotIds = collectAiBlockIds(blocksToAiBlockViews([para]))
    const context = {
      mode: "slash" as const,
      cursorBlockId: para.id,
      selectedIds: [],
      snapshotIds,
    }
    expect(
      validateAiWriteOp(
        { type: "remove_blocks", ids: [para.id] },
        context
      ).ok
    ).toBe(false)
    expect(
      validateAiWriteOp(
        {
          type: "insert_blocks",
          refId: para.id,
          placement: "nested",
          blocks: [{ type: "paragraph", text: "x" }],
        },
        context
      ).ok
    ).toBe(false)
  })

  it("allows slash insert after cursor and selection update only on selected ids", () => {
    const snapshotIds = new Set([para.id, "sel"])
    expect(
      validateAiWriteOp(
        {
          type: "insert_blocks",
          refId: para.id,
          placement: "after",
          blocks: [{ type: "heading", text: "Title", props: { level: 2 } }],
        },
        {
          mode: "slash",
          cursorBlockId: para.id,
          selectedIds: [],
          snapshotIds,
        }
      ).ok
    ).toBe(true)
    expect(
      validateAiWriteOp(
        { type: "update_block", id: para.id, text: "nope" },
        {
          mode: "selection",
          cursorBlockId: para.id,
          selectedIds: ["sel"],
          snapshotIds,
        }
      ).ok
    ).toBe(false)
  })

  it("treats whitespace-only paragraph as empty", () => {
    expect(
      isEmptyTextBlock({
        ...para,
        content: [{ type: "text", text: "  ", styles: {} }],
      })
    ).toBe(true)
  })
})

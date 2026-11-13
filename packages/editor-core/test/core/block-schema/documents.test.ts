import { describe, expect, it } from "vitest"
import {
  createEmptyBlocks,
  createStarterBlocks,
  isBlockArray,
} from "@core/model/documents"
import { MAX_NEST_DEPTH } from "@core/model/ids"

describe("block documents", () => {
  it("creates a single empty paragraph block", () => {
    const blocks = createEmptyBlocks()
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe("paragraph")
    expect(blocks[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(blocks[0]?.children).toEqual([])
    expect(isBlockArray(blocks)).toBe(true)
    expect(isBlockArray({ type: "doc", content: [] })).toBe(false)
  })

  it("keeps starter copy and list-as-block shape", () => {
    const blocks = createStarterBlocks()
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "quote",
      "codeBlock",
    ])
    expect(blocks[0]?.props).toEqual({ level: 1 })
    expect(MAX_NEST_DEPTH).toBe(8)
  })
})

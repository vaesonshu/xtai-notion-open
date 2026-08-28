import { describe, expect, it } from "vitest"
import {
  createEmptyBlocks,
  createStarterBlocks,
  isBlockArray,
} from "@core/block-schema/documents"

describe("core document entry point", () => {
  it("exposes the stable block document contract", () => {
    expect(isBlockArray(createEmptyBlocks())).toBe(true)
    expect(isBlockArray(createStarterBlocks())).toBe(true)
    expect(createEmptyBlocks()[0]?.type).toBe("paragraph")
    expect(createStarterBlocks().map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "quote",
      "codeBlock",
    ])
  })
})

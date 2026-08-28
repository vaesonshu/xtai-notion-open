import { describe, expect, it } from "vitest"
import {
  createEmptyBlocks,
  createStarterBlocks,
  isBlockArray,
} from "./block-schema/documents"
import {
  createEmptyDocument,
  createStarterDocument,
} from "./document"
import { createInitialDocument } from "./document/initial-document"

describe("core document entry point", () => {
  it("exposes the stable block document contract", () => {
    expect(isBlockArray(createEmptyDocument())).toBe(true)
    expect(isBlockArray(createStarterDocument())).toBe(true)
    expect(createEmptyDocument()[0]?.type).toBe("paragraph")
    expect(createStarterDocument().map((block) => block.type)).toEqual(
      createStarterBlocks().map((block) => block.type)
    )
  })

  it("keeps the legacy initial document entry point", () => {
    expect(createInitialDocument().map((block) => block.type)).toEqual(
      createStarterBlocks().map((block) => block.type)
    )
  })
})

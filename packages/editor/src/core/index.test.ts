import { describe, expect, it } from "vitest"
import {
  createEmptyDocument,
  createInitialDocument,
  createStarterDocument,
  isEditorDocument,
} from "./index"

describe("core document entry point", () => {
  it("exposes the stable document contract", () => {
    expect(isEditorDocument(createEmptyDocument())).toBe(true)
    expect(isEditorDocument(createStarterDocument())).toBe(true)
  })

  it("keeps the legacy initial document entry point", () => {
    expect(createInitialDocument()).toEqual(createStarterDocument())
  })
})
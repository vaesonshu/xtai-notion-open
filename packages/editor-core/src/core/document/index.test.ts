import { describe, expect, it } from "vitest"
import {
  createEmptyBlocks,
  createStarterBlocks,
  isBlockArray,
} from "../block-schema/documents"
import {
  createEmptyDocument,
  createStarterDocument,
  isEditorDocument,
} from "./index"

describe("editor document contract", () => {
  describe("createEmptyDocument", () => {
    it("returns deprecated alias for createEmptyBlocks", () => {
      const document = createEmptyDocument()
      expect(isBlockArray(document)).toBe(true)
      expect(document).toHaveLength(1)
      expect(document[0]).toMatchObject({
        type: "paragraph",
        props: {},
        children: [],
        content: [],
      })
    })
  })

  describe("createStarterDocument", () => {
    it("returns deprecated alias for createStarterBlocks", () => {
      const document = createStarterDocument()
      const expected = createStarterBlocks()
      const blockTypes = document.map((block) => block.type)

      expect(document).toHaveLength(expected.length)
      expect(blockTypes).toEqual(expected.map((block) => block.type))
      expect(document.length).toBeGreaterThan(0)
      expect(blockTypes).toEqual(
        expect.arrayContaining([
          "heading",
          "paragraph",
          "bulletListItem",
          "quote",
          "codeBlock",
        ])
      )
    })
  })

  describe("isEditorDocument", () => {
    it("accepts valid doc JSON", () => {
      expect(isEditorDocument({ type: "doc", content: [] })).toBe(true)
      expect(
        isEditorDocument({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Hi" }] },
          ],
        })
      ).toBe(true)
    })

    it("rejects values without type doc", () => {
      expect(isEditorDocument(null)).toBe(false)
      expect(isEditorDocument(undefined)).toBe(false)
      expect(isEditorDocument({})).toBe(false)
      expect(isEditorDocument({ type: "paragraph", content: [] })).toBe(false)
    })

    it("rejects doc values without content array", () => {
      expect(isEditorDocument({ type: "doc" })).toBe(false)
      expect(isEditorDocument({ type: "doc", content: null })).toBe(false)
      expect(isEditorDocument({ type: "doc", content: "blocks" })).toBe(false)
    })
  })
})

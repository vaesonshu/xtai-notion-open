import { describe, expect, it } from "vitest"
import {
  createEmptyDocument,
  createStarterDocument,
  isEditorDocument,
} from "./document.js"

describe("editor document contract", () => {
  describe("createEmptyDocument", () => {
    it("returns an empty doc with no content blocks", () => {
      expect(createEmptyDocument()).toEqual({
        type: "doc",
        content: [],
      })
    })
  })

  describe("createStarterDocument", () => {
    it("returns a doc with representative editable block types", () => {
      const document = createStarterDocument()
      const blockTypes = document.content.map((block) => (block as { type: string }).type)

      expect(document.type).toBe("doc")
      expect(document.content.length).toBeGreaterThan(0)
      expect(blockTypes).toEqual(expect.arrayContaining([
        "heading",
        "paragraph",
        "bulletList",
        "blockquote",
        "codeBlock",
      ]))
    })
  })

  describe("isEditorDocument", () => {
    it("accepts valid doc JSON", () => {
      expect(isEditorDocument({ type: "doc", content: [] })).toBe(true)
      expect(
        isEditorDocument({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
        }),
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

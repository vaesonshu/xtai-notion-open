import { describe, expect, it } from "vitest"
import {
  parsePartialToolArgs,
  partialArgsHaveNonEmptyText,
  sanitizePartialToolArgs,
} from "@core/ai-write"

describe("parsePartialToolArgs", () => {
  it("returns complete objects unchanged", () => {
    expect(parsePartialToolArgs('{"text":"hello"}')).toEqual({
      text: "hello",
    })
  })

  it("repairs a truncated string value", () => {
    expect(parsePartialToolArgs('{"text":"hel')).toEqual({ text: "hel" })
  })

  it("returns null for empty or irreparable input", () => {
    expect(parsePartialToolArgs("")).toBeNull()
    expect(parsePartialToolArgs("{")).toEqual({})
    expect(parsePartialToolArgs("not json")).toBeNull()
  })
})

describe("sanitizePartialToolArgs", () => {
  it("drops unknown tools and invalid placement", () => {
    expect(sanitizePartialToolArgs("other", {})).toBeNull()
    expect(
      sanitizePartialToolArgs("insert_blocks", { placement: "nested" })
    ).toBeNull()
  })

  it("omits blocks whose type is present but not writable", () => {
    const result = sanitizePartialToolArgs("insert_blocks", {
      refId: "a",
      placement: "after",
      blocks: [
        { type: "image", text: "x" },
        { type: "paragraph", text: "ok" },
      ],
    })
    expect(result?.args.blocks).toEqual([{ type: "paragraph", text: "ok" }])
  })
})

describe("partialArgsHaveNonEmptyText", () => {
  it("detects insert and update text", () => {
    expect(
      partialArgsHaveNonEmptyText("update_block", { text: "a" })
    ).toBe(true)
    expect(
      partialArgsHaveNonEmptyText("insert_blocks", {
        blocks: [{ type: "paragraph", text: "" }],
      })
    ).toBe(false)
  })
})

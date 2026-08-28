import { describe, expect, it } from "vitest"
import { defineBlockSpec } from "@core/schema/block-spec"
import {
  createEditorSchema,
  DEFAULT_BUILTIN_BLOCK_COUNT,
} from "@core/schema/create-editor-schema"

describe("createEditorSchema", () => {
  it("includes all built-in block types by default", () => {
    const schema = createEditorSchema()
    expect(schema.blockTypes).toHaveLength(DEFAULT_BUILTIN_BLOCK_COUNT)
    expect(schema.blockTypes).toContain("paragraph")
    expect(schema.blockTypes).toContain("canvas")
  })

  it("appends custom blocks", () => {
    const callout = defineBlockSpec({
      type: "callout",
      propSchema: { variant: { default: "info" } },
      content: "inline",
    })

    const schema = createEditorSchema({ blocks: [callout] })
    expect(schema.blockTypes).toHaveLength(DEFAULT_BUILTIN_BLOCK_COUNT + 1)
    expect(schema.blockTypes).toContain("callout")
  })

  it("throws when appending a conflicting block type", () => {
    const duplicate = defineBlockSpec({
      type: "paragraph",
      propSchema: {},
      content: "inline",
      alsoBlockGroup: true,
    })

    expect(() => createEditorSchema({ blocks: [duplicate] })).toThrow(
      /already registered/
    )
  })

  it("omits built-in block types", () => {
    const schema = createEditorSchema({ omit: ["canvas"] })
    expect(schema.blockTypes).not.toContain("canvas")
    expect(schema.blockTypes).toHaveLength(DEFAULT_BUILTIN_BLOCK_COUNT - 1)
  })

  it("builds tiptap extensions from registry", () => {
    const extensions = createEditorSchema().getExtensions()
    const names = extensions.map((ext) => ext.name)
    expect(names).toContain("doc")
    expect(names).toContain("blockGroup")
    expect(names).toContain("paragraph")
  })
})

import { describe, expect, it } from "vitest"
import { defineBlockSpec } from "@core/schema/block-spec"
import { BlockSchemaRegistry } from "@core/schema/registry"

describe("BlockSchemaRegistry", () => {
  it("registers specs and exposes block content extensions", () => {
    const callout = defineBlockSpec(
      {
        type: "callout",
        propSchema: { variant: { default: "info" } },
        content: "inline",
      },
      {
        renderHTML: () => ["div", { "data-type": "callout" }, 0],
      }
    )

    const registry = new BlockSchemaRegistry([callout])
    expect(registry.getAllBlockTypes()).toEqual(["callout"])
    expect(registry.getBlockContentTypes()).toEqual(new Set(["callout"]))
    expect(registry.getBlockContentExtensions()).toHaveLength(1)
    expect(registry.getBlockContentExtensions()[0]?.name).toBe("callout")
  })

  it("throws when registering duplicate block types", () => {
    const spec = defineBlockSpec({
      type: "callout",
      propSchema: {},
      content: "inline",
    })
    const registry = new BlockSchemaRegistry([spec])
    expect(() => registry.register(spec)).toThrow(/already registered/)
  })
})

describe("defineBlockSpec", () => {
  it("creates blockContent nodes with inline content", () => {
    const spec = defineBlockSpec({
      type: "callout",
      propSchema: { variant: { default: "info" } },
      content: "inline",
    })

    expect(spec.config.type).toBe("callout")
    expect(spec.node.name).toBe("callout")
    expect(spec.config.content).toBe("inline")
  })
})

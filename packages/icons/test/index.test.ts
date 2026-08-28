import { describe, expect, expectTypeOf, it } from "vitest"
import { BoldIcon, type Icon } from "@workspace/icons"

describe("@workspace/icons exports", () => {
  it("exports BoldIcon as a renderable Lucide component", () => {
    expect(BoldIcon).toBeDefined()
    expect(typeof BoldIcon).toBe("function")
  })

  it("exports Icon type alias compatible with exported icons", () => {
    expectTypeOf<Icon>().not.toBeAny()
    expectTypeOf<typeof BoldIcon>().toExtend<Icon>()
  })
})

import { describe, expect, it } from "vitest"
import { BoldIcon, type Icon } from "@workspace/icons"

describe("@workspace/icons exports", () => {
  it("exports BoldIcon as a renderable Lucide component", () => {
    expect(BoldIcon).toBeDefined()
    expect(typeof BoldIcon).toBe("function")
  })

  it("exports Icon type alias for component props", () => {
    const icon: Icon = BoldIcon
    expect(icon).toBe(BoldIcon)
  })
})

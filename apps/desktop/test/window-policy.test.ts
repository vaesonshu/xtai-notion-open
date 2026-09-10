import { describe, expect, it } from "vitest"
import { shouldHideOnClose } from "../src/lib/window-policy"

describe("shouldHideOnClose", () => {
  it("hides when the user did not quit", () => {
    expect(shouldHideOnClose(false)).toBe(true)
  })

  it("allows close when quitting", () => {
    expect(shouldHideOnClose(true)).toBe(false)
  })
})

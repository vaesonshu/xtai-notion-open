import { describe, expect, it } from "vitest"
import { hexToHsl, hslToHex } from "@shadcn-src/components/menus/text-color-utils"

describe("text color utils", () => {
  it("produces normalized hex from hsl", () => {
    expect(hslToHex(152, 56, 33)).toMatch(/^#[0-9A-F]{6}$/)
  })

  it("parses hex into hsl components within valid ranges", () => {
    const hsl = hexToHsl("#24866B")
    expect(hsl.h).toBeGreaterThanOrEqual(0)
    expect(hsl.h).toBeLessThanOrEqual(360)
    expect(hsl.s).toBeGreaterThanOrEqual(0)
    expect(hsl.s).toBeLessThanOrEqual(100)
    expect(hsl.l).toBeGreaterThanOrEqual(0)
    expect(hsl.l).toBeLessThanOrEqual(100)
  })

  it("normalizes shorthand hex when converting to HSL", () => {
    expect(hexToHsl("#abc")).toEqual(hexToHsl("#AABBCC"))
  })
})

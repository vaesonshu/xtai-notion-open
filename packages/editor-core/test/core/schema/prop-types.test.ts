import { describe, expect, it } from "vitest"
import { propsToAttributes, type PropSchema } from "@core/schema/prop-types"

describe("propsToAttributes", () => {
  it("maps defaults for block props", () => {
    const schema: PropSchema = {
      level: { default: 1 },
      checked: { default: false },
    }
    const attrs = propsToAttributes(schema)
    expect(attrs.level?.default).toBe(1)
    expect(attrs.checked?.default).toBe(false)
  })

  it("omits HTML attributes when value equals default", () => {
    const schema: PropSchema = {
      level: { default: 1 },
    }
    const attrs = propsToAttributes(schema)
    expect(attrs.level?.renderHTML?.({ level: 1 })).toEqual({})
    expect(attrs.level?.renderHTML?.({ level: 2 })).toEqual({
      level: "2",
    })
  })
})

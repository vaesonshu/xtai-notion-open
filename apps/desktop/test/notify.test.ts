import { describe, expect, it } from "vitest"
import { sanitizeNotifyPayload } from "../src/lib/notify"

describe("sanitizeNotifyPayload", () => {
  it("returns null for missing title", () => {
    expect(sanitizeNotifyPayload({})).toBeNull()
    expect(sanitizeNotifyPayload({ title: "  " })).toBeNull()
  })

  it("trims and truncates title and body", () => {
    const title = "t".repeat(80)
    const body = "b".repeat(300)
    expect(sanitizeNotifyPayload({ title, body, extra: 1 })).toEqual({
      title: "t".repeat(64),
      body: "b".repeat(256),
    })
  })
})

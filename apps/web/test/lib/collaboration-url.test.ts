import { describe, expect, it } from "vitest"
import { normalizeCollaborationWebSocketUrl } from "@/lib/collaboration-url"

describe("normalizeCollaborationWebSocketUrl", () => {
  it("rewrites https to wss", () => {
    expect(
      normalizeCollaborationWebSocketUrl(
        "https://xtai-collaboration.onrender.com"
      )
    ).toBe("wss://xtai-collaboration.onrender.com")
  })

  it("keeps ws and wss unchanged", () => {
    expect(normalizeCollaborationWebSocketUrl("ws://127.0.0.1:3101")).toBe(
      "ws://127.0.0.1:3101"
    )
    expect(normalizeCollaborationWebSocketUrl("wss://example.com")).toBe(
      "wss://example.com"
    )
  })
})

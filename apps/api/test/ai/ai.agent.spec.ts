import { describe, expect, it } from "vitest"

describe("AiAgent", () => {
  it("loads module export", async () => {
    const { AiAgent } = await import("@api/ai/ai.agent")
    expect(AiAgent).toBeDefined()
  })
})

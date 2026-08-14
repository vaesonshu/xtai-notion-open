import { describe, expect, it } from "vitest"
import { AiAgent } from "./ai.agent"

describe("AiAgent", () => {
  it("returns a stable configuration error when model settings are missing", async () => {
    const agent = new AiAgent({} as any)
    await expect(async () => {
      for await (const _token of agent.stream({
        documentText: "文档",
        messages: [],
      })) {
      }
    }).rejects.toThrow("AI 服务未配置")
  })
})

import { describe, expect, it, vi } from "vitest"
import { AiController } from "@api/ai/ai.controller"

describe("AiController", () => {
  it("writes token and done events as SSE", async () => {
    const ai = {
      chat: vi.fn(async function* () {
        yield { type: "token", content: "你好" }
        yield { type: "done" }
      }),
    }
    const writes: string[] = []
    const response = {
      status: vi.fn(),
      setHeader: vi.fn(),
      writableEnded: false,
      write: (value: string) => writes.push(value),
      end: vi.fn(),
    }
    const request = { on: vi.fn() }
    await new AiController(ai as any).chat(
      {} as any,
      { id: "u" },
      request,
      response
    )
    expect(writes.join("")).toContain(
      'event: token\ndata: {"type":"token","content":"你好"}'
    )
    expect(response.end).toHaveBeenCalled()
  })
})

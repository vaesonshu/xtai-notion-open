import { describe, expect, it, vi } from "vitest"
import { AiController } from "@api/ai/ai.controller"

function createSseMocks() {
  const writes: string[] = []
  const response = {
    status: vi.fn(),
    setHeader: vi.fn(),
    writableEnded: false,
    write: (value: string) => writes.push(value),
    end: vi.fn(),
  }
  const request = { on: vi.fn() }
  return { writes, response, request }
}

describe("AiController", () => {
  it("writes token and done events as SSE", async () => {
    const ai = {
      chat: vi.fn(async function* () {
        yield { type: "token", content: "你好" }
        yield { type: "done" }
      }),
      write: vi.fn(),
    }
    const { writes, response, request } = createSseMocks()
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

  it("writes tool_call and done events as SSE for write", async () => {
    const ai = {
      chat: vi.fn(),
      write: vi.fn(async function* () {
        yield {
          type: "tool_call",
          op: {
            type: "insert_blocks",
            refId: "b1",
            placement: "after",
            blocks: [{ type: "paragraph", text: "hi" }],
          },
        }
        yield { type: "done" }
      }),
    }
    const { writes, response, request } = createSseMocks()
    await new AiController(ai as any).write(
      {} as any,
      { id: "u" },
      request,
      response
    )
    expect(writes.join("")).toContain('event: tool_call')
    expect(writes.join("")).toContain('"type":"insert_blocks"')
    expect(writes.join("")).toContain('event: done')
    expect(response.end).toHaveBeenCalled()
  })
})

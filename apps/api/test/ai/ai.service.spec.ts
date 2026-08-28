import { BadRequestException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import { AiService } from "@api/ai/ai.service"

function request() {
  return {
    documentId: "doc-1",
    documentText: "正文",
    messages: [{ role: "user" as const, content: "总结" }],
  }
}

describe("AiService", () => {
  it("checks document read access before streaming tokens", async () => {
    const documents = { assertCanRead: vi.fn().mockResolvedValue("viewer") }
    const agent = {
      stream: vi.fn(async function* () {
        yield "答"
      }),
    }
    const events = []
    for await (const event of new AiService(
      documents as any,
      agent as any
    ).chat(request(), "user-1"))
      events.push(event)
    expect(documents.assertCanRead).toHaveBeenCalledWith("doc-1", "user-1")
    expect(events).toEqual([{ type: "token", content: "答" }, { type: "done" }])
  })

  it("rejects oversized input", async () => {
    const service = new AiService({ assertCanRead: vi.fn() } as any, {} as any)
    await expect(async () => {
      for await (const _event of service.chat(
        { ...request(), documentText: "x".repeat(100_001) },
        "user-1"
      )) {
      }
    }).rejects.toBeInstanceOf(BadRequestException)
  })
})

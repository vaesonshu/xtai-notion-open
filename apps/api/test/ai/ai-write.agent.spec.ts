import { describe, expect, it } from "vitest"
import { AiWriteAgent } from "@api/ai/ai-write.agent"
import type { AiWriteRequest } from "@api/ai/ai.types"

const paraId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const testLlm = {
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
}

const slashRequest: AiWriteRequest = {
  documentId: "doc-1",
  mode: "slash",
  prompt: "续写一段",
  cursorBlockId: paraId,
  selectedIds: [],
  blocks: [
    {
      id: paraId,
      type: "paragraph",
      text: "hello",
      writable: true,
      children: [],
    },
  ],
}

describe("AiWriteAgent", () => {
  it("yields validated insert_blocks as AiWriteOp", async () => {
    const agent = new AiWriteAgent({ NODE_ENV: "test" } as any, async function* () {
      yield {
        type: "insert_blocks",
        refId: paraId,
        placement: "after",
        blocks: [{ type: "paragraph", text: "续写内容" }],
      }
    })

    const events = []
    for await (const event of agent.stream(slashRequest, undefined, testLlm)) {
      events.push(event)
    }

    const ops = events
      .filter((event) => event.type === "tool_call")
      .map((event) => event.op)

    expect(events[0]).toMatchObject({ type: "tool_call", toolIndex: 0 })
    expect(ops).toEqual([
      {
        type: "insert_blocks",
        refId: paraId,
        placement: "after",
        blocks: [{ type: "paragraph", text: "续写内容" }],
      },
    ])
  })

  it("yields tool_partial then validated tool_call from injected runner", async () => {
    const agent = new AiWriteAgent({ NODE_ENV: "test" } as any, async function* () {
      yield {
        type: "tool_partial",
        toolIndex: 0,
        name: "insert_blocks",
        args: {
          refId: paraId,
          placement: "after",
          blocks: [{ type: "paragraph", text: "续" }],
        },
      }
      yield {
        type: "insert_blocks",
        refId: paraId,
        placement: "after",
        blocks: [{ type: "paragraph", text: "续写内容" }],
      }
    })
    const events = []
    for await (const event of agent.stream(slashRequest, undefined, testLlm)) {
      events.push(event)
    }
    expect(events[0]).toMatchObject({
      type: "tool_partial",
      toolIndex: 0,
      name: "insert_blocks",
    })
    expect(events[1]).toMatchObject({
      type: "tool_call",
      toolIndex: 0,
      op: { type: "insert_blocks" },
    })
  })

  it("skips invalid tool calls such as nested placement", async () => {
    const agent = new AiWriteAgent({ NODE_ENV: "test" } as any, async function* () {
      yield {
        type: "insert_blocks",
        refId: paraId,
        placement: "nested",
        blocks: [{ type: "paragraph", text: "x" }],
      }
    })

    const ops = []
    for await (const event of agent.stream(slashRequest, undefined, testLlm)) {
      if (event.type === "tool_call") {
        ops.push(event.op)
      }
    }

    expect(ops).toHaveLength(0)
  })

  it("yields nothing when runner produces no tool calls", async () => {
    const agent = new AiWriteAgent({ NODE_ENV: "test" } as any, async function* () {})

    const events = []
    for await (const event of agent.stream(slashRequest, undefined, testLlm)) {
      events.push(event)
    }

    expect(events).toHaveLength(0)
  })
})

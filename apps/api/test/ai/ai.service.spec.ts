import { BadRequestException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import { AiService } from "@api/ai/ai.service"

function chatRequest() {
  return {
    documentId: "doc-1",
    documentText: "正文",
    messages: [{ role: "user" as const, content: "总结" }],
  }
}

function writeRequest() {
  return {
    documentId: "doc-1",
    mode: "slash" as const,
    prompt: "续写一段",
    cursorBlockId: "block-1",
    selectedIds: [] as string[],
    blocks: [
      {
        id: "block-1",
        type: "paragraph",
        text: "hello",
        writable: true,
        children: [],
      },
    ],
  }
}

function createService(
  documents: { assertCanRead: ReturnType<typeof vi.fn> },
  agent: { stream: ReturnType<typeof vi.fn> },
  writeAgent: { stream: ReturnType<typeof vi.fn> } = { stream: vi.fn() },
  userCloudAi: {
    requireLlmConfig: ReturnType<typeof vi.fn>
  } = {
    requireLlmConfig: vi.fn().mockResolvedValue({
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    }),
  },
  workspaces: { getWorkspace: ReturnType<typeof vi.fn> } = {
    getWorkspace: vi.fn().mockResolvedValue({
      id: "ws-1",
      name: "产品知识库",
      role: "owner",
      aiSettings: { aiProvider: "cloud" },
      memberCount: 1,
      documentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  },
  articleAgent: { stream: ReturnType<typeof vi.fn> } = { stream: vi.fn() }
) {
  return new AiService(
    documents as any,
    workspaces as any,
    userCloudAi as any,
    agent as any,
    writeAgent as any,
    articleAgent as any
  )
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
    for await (const event of createService(documents, agent).chat(
      chatRequest(),
      "user-1"
    ))
      events.push(event)
    expect(documents.assertCanRead).toHaveBeenCalledWith("doc-1", "user-1")
    expect(events).toEqual([{ type: "token", content: "答" }, { type: "done" }])
  })

  it("rejects oversized input", async () => {
    const service = createService(
      { assertCanRead: vi.fn() },
      { stream: vi.fn() }
    )
    await expect(async () => {
      for await (const _event of service.chat(
        { ...chatRequest(), documentText: "x".repeat(100_001) },
        "user-1"
      )) {
      }
    }).rejects.toBeInstanceOf(BadRequestException)
  })

  it("checks document read access before streaming write tool calls", async () => {
    const documents = { assertCanRead: vi.fn().mockResolvedValue("viewer") }
    const writeAgent = {
      stream: vi.fn(async function* () {
        yield {
          type: "tool_call",
          toolIndex: 0,
          op: {
            type: "insert_blocks",
            refId: "block-1",
            placement: "after",
            blocks: [{ type: "paragraph", text: "new" }],
          },
        }
      }),
    }
    const events = []
    for await (const event of createService(
      documents,
      { stream: vi.fn() },
      writeAgent
    ).write(writeRequest(), "user-1"))
      events.push(event)
    expect(documents.assertCanRead).toHaveBeenCalledWith("doc-1", "user-1")
    expect(events).toEqual([
      {
        type: "tool_call",
        toolIndex: 0,
        op: {
          type: "insert_blocks",
          refId: "block-1",
          placement: "after",
          blocks: [{ type: "paragraph", text: "new" }],
        },
      },
      { type: "done" },
    ])
  })

  it("rejects oversized write input", async () => {
    const service = createService(
      { assertCanRead: vi.fn() },
      { stream: vi.fn() },
      { stream: vi.fn() }
    )
    await expect(async () => {
      for await (const _event of service.write(
        { ...writeRequest(), prompt: "x".repeat(10_001) },
        "user-1"
      )) {
      }
    }).rejects.toBeInstanceOf(BadRequestException)
  })

  it("yields error when write agent produces no tool calls", async () => {
    const writeAgent = { stream: vi.fn(async function* () {}) }
    const events = []
    for await (const event of createService(
      { assertCanRead: vi.fn().mockResolvedValue("viewer") },
      { stream: vi.fn() },
      writeAgent
    ).write(writeRequest(), "user-1"))
      events.push(event)
    expect(events).toEqual([{ type: "error", message: "没有可应用的改动" }])
  })

  it("emits done when only non-empty tool_partial was streamed", async () => {
    const writeAgent = {
      stream: vi.fn(async function* () {
        yield {
          type: "tool_partial",
          toolIndex: 0,
          name: "update_block",
          args: { id: "block-1", text: "x" },
        }
      }),
    }
    const events = []
    for await (const event of createService(
      { assertCanRead: vi.fn().mockResolvedValue("viewer") },
      { stream: vi.fn() },
      writeAgent
    ).write(writeRequest(), "user-1")) {
      events.push(event)
    }
    expect(events[0]).toMatchObject({
      type: "tool_partial",
      toolIndex: 0,
      name: "update_block",
    })
    expect(events.at(-1)).toEqual({ type: "done" })
  })
})

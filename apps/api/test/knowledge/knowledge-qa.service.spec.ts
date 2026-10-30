import { BadRequestException, ForbiddenException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { EmbeddingConfig } from "@api/knowledge/embedding-client"
import {
  CITATION_EXCERPT_CHARS,
  KNOWLEDGE_QA_SYSTEM_PROMPT,
  NO_HIT_ANSWER,
  type KnowledgeHitRow,
} from "@api/knowledge/knowledge-retrieval"
import { KnowledgeQaService } from "@api/knowledge/knowledge-qa.service"
import type { KnowledgeRetrievalStore } from "@api/knowledge/knowledge-source.repository"
import type { KnowledgeLibraryService } from "@api/knowledge/knowledge-library.service"
import type { LibraryMembership } from "@api/knowledge/knowledge-library.repository"
import type { EmbeddingSettings } from "@api/knowledge/knowledge.types"

const USER_ID = "user-1"
const OUTSIDER_ID = "outsider-1"
const LIBRARY_ID = "lib-1"

const EMBEDDING_SETTINGS: EmbeddingSettings = {
  openAiApiKey: "sk-test",
  openAiBaseUrl: "https://api.example.com/v1",
  openAiEmbeddingModel: "text-embedding-3-small",
}

type ChatInput = {
  system: string
  messages: { role: string; content: string }[]
}

class FakeRetrievalStore implements KnowledgeRetrievalStore {
  hits: KnowledgeHitRow[] = []
  pendingSourceCount = 0
  nearestCalls: Array<{
    libraryId: string
    embeddingRevision: number
    embedding: number[]
  }> = []

  async findNearestChunks(input: {
    libraryId: string
    embeddingRevision: number
    embedding: number[]
  }): Promise<KnowledgeHitRow[]> {
    this.nearestCalls.push(input)
    return this.hits.map((hit) => ({ ...hit }))
  }

  async countPendingSources(
    _libraryId: string,
    _embeddingRevision: number
  ): Promise<number> {
    return this.pendingSourceCount
  }
}

function hitRow(overrides: Partial<KnowledgeHitRow> = {}): KnowledgeHitRow {
  return {
    distance: 0.1,
    libraryId: LIBRARY_ID,
    generation: 1,
    activeGeneration: 1,
    embeddingRevision: 1,
    libraryRevision: 1,
    content: "定价条款写在第三节",
    sourceId: "src-1",
    sourceTitle: "定价手册",
    heading: "概述",
    page: null,
    ...overrides,
  }
}

function membership(
  overrides: Partial<LibraryMembership> = {}
): LibraryMembership {
  return {
    role: "viewer",
    name: "产品资料",
    embeddingSettings: EMBEDDING_SETTINGS,
    embeddingRevision: 1,
    ...overrides,
  }
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iter) {
    items.push(item)
  }
  return items
}

function makeHarness(
  options: {
    member?: LibraryMembership | null
    outsider?: boolean
    hits?: KnowledgeHitRow[]
    pendingSourceCount?: number
    embedTexts?: (
      config: EmbeddingConfig,
      texts: string[]
    ) => Promise<number[][]>
    streamChat?: (input: ChatInput) => AsyncIterable<string>
  } = {}
) {
  const sources = new FakeRetrievalStore()
  sources.hits = options.hits ?? []
  sources.pendingSourceCount = options.pendingSourceCount ?? 0

  const requireRole = vi.fn(
    async (userId: string, _libraryId: string, _minimum: "viewer") => {
      if (options.outsider || userId === OUTSIDER_ID) {
        throw new ForbiddenException("无权访问该资料库")
      }
      return options.member === null
        ? membership({ embeddingSettings: {} })
        : (options.member ?? membership())
    }
  )

  const embedTexts = vi.fn(
    options.embedTexts ??
      (async (_config: EmbeddingConfig, texts: string[]) =>
        texts.map(() => [0.42]))
  )
  const streamChat = vi.fn(
    options.streamChat ??
      async function* (_input: ChatInput) {
        yield "根据资料"
      }
  )
  const requireLlmConfig = vi.fn(async () => ({
    apiKey: "sk-chat",
    baseUrl: "https://api.example.com/v1",
    model: "gpt-4o-mini",
  }))

  const service = new KnowledgeQaService(
    { requireRole } as Pick<KnowledgeLibraryService, "requireRole">,
    sources,
    { embedTexts, streamChat, requireLlmConfig }
  )

  return {
    service,
    sources,
    requireRole,
    embedTexts,
    streamChat,
    requireLlmConfig,
  }
}

describe("KnowledgeQaService.retrieve", () => {
  it("rejects a non-member", async () => {
    const { service, sources, embedTexts } = makeHarness({ outsider: true })

    await expect(
      service.retrieve(OUTSIDER_ID, LIBRARY_ID, "定价是多少")
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      service.retrieve(OUTSIDER_ID, LIBRARY_ID, "定价是多少")
    ).rejects.toThrow("无权访问该资料库")
    expect(sources.nearestCalls).toHaveLength(0)
    expect(embedTexts).not.toHaveBeenCalled()
  })

  it("returns pendingSourceCount from the store", async () => {
    const { service } = makeHarness({
      hits: [hitRow()],
      pendingSourceCount: 2,
    })

    const result = await service.retrieve(USER_ID, LIBRARY_ID, "定价是多少")

    expect(result.pendingSourceCount).toBe(2)
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0]?.index).toBe(1)
  })

  it("rejects when the library embedding model is missing", async () => {
    const { service, embedTexts } = makeHarness({ member: null })

    await expect(
      service.retrieve(USER_ID, LIBRARY_ID, "定价是多少")
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.retrieve(USER_ID, LIBRARY_ID, "定价是多少")
    ).rejects.toThrow("请先配置资料库的嵌入模型")
    expect(embedTexts).not.toHaveBeenCalled()
  })
})

describe("KnowledgeQaService.answer", () => {
  it("skips chat and emits the fixed sentence when nothing matches", async () => {
    const { service, streamChat, requireLlmConfig } = makeHarness({
      hits: [],
      pendingSourceCount: 2,
    })

    const events = await collect(
      service.answer(USER_ID, LIBRARY_ID, [
        { role: "user", content: "定价是多少" },
      ])
    )

    expect(streamChat).toHaveBeenCalledTimes(0)
    expect(requireLlmConfig).toHaveBeenCalledWith(USER_ID)
    expect(events).toEqual([
      { type: "citations", citations: [], pendingSourceCount: 2 },
      { type: "token", content: NO_HIT_ANSWER },
      { type: "done" },
    ])
  })

  it("sends the exact system prompt and a user prompt containing [1]", async () => {
    const { service, streamChat } = makeHarness({
      hits: [hitRow()],
    })

    const events = await collect(
      service.answer(USER_ID, LIBRARY_ID, [
        { role: "user", content: "定价是多少" },
      ])
    )

    expect(streamChat).toHaveBeenCalledTimes(1)
    const input = streamChat.mock.calls[0]?.[0] as ChatInput
    expect(input.system).toBe(KNOWLEDGE_QA_SYSTEM_PROMPT)
    const userPrompt = input.messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n")
    expect(userPrompt).toContain("[1]")
    expect(events[0]).toMatchObject({ type: "citations" })
    expect(events.at(-1)).toEqual({ type: "done" })
  })

  it("omits content from citations SSE and keeps excerpt at most 500 chars", async () => {
    // SSE 只发摘录：完整 content 留给提示词，避免引用事件泄漏整段正文。
    const longContent = `前${"摘".repeat(CITATION_EXCERPT_CHARS)}尾`
    const { service } = makeHarness({
      hits: [hitRow({ content: longContent })],
    })

    const events = await collect(
      service.answer(USER_ID, LIBRARY_ID, [
        { role: "user", content: "定价是多少" },
      ])
    )

    const citationsEvent = events[0]
    expect(citationsEvent).toMatchObject({ type: "citations" })
    if (citationsEvent?.type !== "citations") {
      throw new Error("expected citations event")
    }
    const citation = citationsEvent.citations[0]
    expect(citation).toBeDefined()
    expect(citation).not.toHaveProperty("content")
    expect(citation?.excerpt.length).toBeLessThanOrEqual(CITATION_EXCERPT_CHARS)
    expect(citation?.excerpt).toBe(longContent.slice(0, CITATION_EXCERPT_CHARS))
  })

  it("embeds only the latest user question and keeps earlier turns for chat", async () => {
    const { service, embedTexts, streamChat } = makeHarness({
      hits: [hitRow()],
    })

    await collect(
      service.answer(USER_ID, LIBRARY_ID, [
        { role: "user", content: "先问公司名" },
        { role: "assistant", content: "见手册" },
        { role: "user", content: "那定价呢" },
      ])
    )

    expect(embedTexts).toHaveBeenCalledTimes(1)
    expect(embedTexts.mock.calls[0]?.[1]).toEqual(["那定价呢"])
    const input = streamChat.mock.calls[0]?.[0] as ChatInput
    expect(
      input.messages.some((message) => message.content === "先问公司名")
    ).toBe(true)
    expect(input.messages.some((message) => message.content === "见手册")).toBe(
      true
    )
  })

  it("rejects more than 20 messages or a message longer than 8000 chars", async () => {
    const { service, streamChat } = makeHarness({ hits: [hitRow()] })
    const tooMany = Array.from({ length: 21 }, (_, index) => ({
      role: index === 20 ? ("user" as const) : ("assistant" as const),
      content: index === 20 ? "最后一问" : "占位",
    }))

    await expect(
      collect(service.answer(USER_ID, LIBRARY_ID, tooMany))
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      collect(service.answer(USER_ID, LIBRARY_ID, tooMany))
    ).rejects.toThrow("AI 请求内容超出限制")

    await expect(
      collect(
        service.answer(USER_ID, LIBRARY_ID, [
          { role: "user", content: "问".repeat(8001) },
        ])
      )
    ).rejects.toThrow("AI 请求内容超出限制")

    await expect(
      collect(
        service.answer(USER_ID, LIBRARY_ID, [
          { role: "assistant", content: "不是用户" },
        ])
      )
    ).rejects.toThrow("AI 请求内容超出限制")

    expect(streamChat).toHaveBeenCalledTimes(0)
  })
})

import { describe, expect, it, vi } from "vitest"
import {
  EmbeddingClientError,
  embedKnowledgeTexts,
  type EmbeddingConfig,
} from "@api/knowledge/embedding-client"
import { EMBEDDING_DIMENSIONS } from "@api/knowledge/knowledge.types"

const config: EmbeddingConfig = {
  apiKey: "sk-test-key",
  baseUrl: "https://api.example.com/v1",
  model: "text-embedding-3-small",
}

/** 测试注入立即返回的 sleep，避免真的等待指数退避。 */
const noWait = {
  sleep: async () => undefined,
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function embeddingPayload(vectors: number[][]) {
  return {
    data: vectors.map((embedding, index) => ({ embedding, index })),
  }
}

function unitVector(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0)
}

function requestBody(call: unknown[] | undefined): Record<string, unknown> {
  const init = call?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

function requestHeaders(
  call: unknown[] | undefined
): Record<string, string> | undefined {
  const init = call?.[1] as RequestInit | undefined
  return init?.headers as Record<string, string> | undefined
}

describe("embedKnowledgeTexts", () => {
  it("splits 20 texts into batches of 16 and 4 with dimensions 1536", async () => {
    const texts = Array.from({ length: 20 }, (_, i) => `text-${i}`)
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] }
      return jsonResponse(
        200,
        embeddingPayload(body.input.map(() => unitVector()))
      )
    })

    const result = await embedKnowledgeTexts(config, texts, fetchImpl, noWait)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const first = requestBody(fetchImpl.mock.calls[0])
    const second = requestBody(fetchImpl.mock.calls[1])
    expect((first.input as string[]).length).toBe(16)
    expect((second.input as string[]).length).toBe(4)
    expect(first.dimensions).toBe(1536)
    expect(second.dimensions).toBe(1536)
    expect(first.model).toBe(config.model)
    expect(second.model).toBe(config.model)
    expect(first.input).toEqual(texts.slice(0, 16))
    expect(second.input).toEqual(texts.slice(16))
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/v1/embeddings"
    )
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).method).toBe("POST")
    expect(requestHeaders(fetchImpl.mock.calls[0])?.Authorization).toBe(
      "Bearer sk-test-key"
    )
    expect(result).toHaveLength(20)
    expect(result[0]).toHaveLength(EMBEDDING_DIMENSIONS)
  })

  it("retries without dimensions after 400 mentioning it, then rejects wrong length", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      if ("dimensions" in body) {
        return jsonResponse(400, {
          error: { message: "Unknown parameter: dimensions" },
        })
      }
      return jsonResponse(200, embeddingPayload([[0, 1, 2]]))
    })

    const error = await embedKnowledgeTexts(
      config,
      ["hello"],
      fetchImpl,
      noWait
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(EmbeddingClientError)
    expect((error as EmbeddingClientError).code).toBe("bad_dimensions")
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(requestBody(fetchImpl.mock.calls[1])).not.toHaveProperty(
      "dimensions"
    )
  })

  it("throws invalid_config on 401 without retrying", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { error: "unauthorized" })
    )

    const error = await embedKnowledgeTexts(
      config,
      ["hello"],
      fetchImpl,
      noWait
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(EmbeddingClientError)
    expect((error as EmbeddingClientError).code).toBe("invalid_config")
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("succeeds after two 429 responses then 200", async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls < 3) {
        return jsonResponse(429, { error: "rate limited" })
      }
      return jsonResponse(200, embeddingPayload([unitVector()]))
    })

    const result = await embedKnowledgeTexts(
      config,
      ["hello"],
      fetchImpl,
      noWait
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it("throws unavailable when the fourth attempt still fails", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(429, { error: "rate limited" })
    )

    const error = await embedKnowledgeTexts(
      config,
      ["hello"],
      fetchImpl,
      noWait
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(EmbeddingClientError)
    expect((error as EmbeddingClientError).code).toBe("unavailable")
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it("returns an empty array without fetching when texts is empty", async () => {
    const fetchImpl = vi.fn()
    await expect(
      embedKnowledgeTexts(config, [], fetchImpl, noWait)
    ).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

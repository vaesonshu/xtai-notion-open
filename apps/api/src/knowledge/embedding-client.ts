import { EMBEDDING_DIMENSIONS } from "./knowledge.types"

const BATCH_SIZE = 16
const MAX_ATTEMPTS = 4
const BACKOFF_MS = 250

export type EmbeddingConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

export type EmbeddingClientErrorCode =
  | "invalid_config"
  | "unavailable"
  | "bad_dimensions"

export class EmbeddingClientError extends Error {
  readonly code: EmbeddingClientErrorCode

  constructor(code: EmbeddingClientErrorCode) {
    super(code)
    this.name = "EmbeddingClientError"
    this.code = code
  }
}

type EmbedOptions = {
  sleep?: (ms: number) => Promise<void>
}

type EmbeddingItem = {
  embedding?: number[]
  index?: number
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function embeddingsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/embeddings`
}

function multimodalEmbeddingsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/embeddings/multimodal`
}

/**
 * Agent Plan 只提供 doubao-embedding-vision，走多模态接口，一次请求只嵌一段文本。
 * 普通 OpenAI 兼容接口仍走 /embeddings，一次可以带多段。
 */
export function isAgentPlanVisionEmbedding(config: EmbeddingConfig): boolean {
  const model = config.model.trim().toLowerCase()
  return (
    model === "doubao-embedding-vision" ||
    model.startsWith("doubao-embedding-vision-") ||
    config.baseUrl.toLowerCase().includes("/api/plan/")
  )
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function mentionsDimensions(body: string): boolean {
  return body.toLowerCase().includes("dimensions")
}

/** 按 index 排好后再取出向量，避免提供商乱序导致分块对错位。 */
function vectorsFromPayload(
  payload: unknown,
  expectedCount: number
): number[][] {
  const record = payload as { data?: EmbeddingItem[] } | null
  const items = Array.isArray(record?.data) ? record.data : []
  const sorted = items.toSorted(
    (left, right) => (left.index ?? 0) - (right.index ?? 0)
  )
  const vectors = sorted.map((item) => item.embedding)
  if (vectors.length !== expectedCount) {
    throw new EmbeddingClientError("unavailable")
  }
  for (const vector of vectors) {
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
      throw new EmbeddingClientError("bad_dimensions")
    }
  }
  return vectors as number[][]
}

/** 方舟多模态接口的 data 是对象，不是 OpenAI 那种带 index 的数组。 */
function vectorFromMultimodalPayload(payload: unknown): number[] {
  const data = (payload as { data?: unknown } | null)?.data
  if (data && !Array.isArray(data)) {
    const embedding = (data as { embedding?: unknown }).embedding
    if (
      !Array.isArray(embedding) ||
      embedding.length !== EMBEDDING_DIMENSIONS
    ) {
      throw new EmbeddingClientError("bad_dimensions")
    }
    return embedding as number[]
  }
  return vectorsFromPayload(payload, 1)[0] ?? []
}

async function embedBatch(
  config: EmbeddingConfig,
  texts: string[],
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>
): Promise<number[][]> {
  // 部分兼容接口不认 dimensions；被 400 点名后只剥一次，其它重试仍走退避。
  let includeDimensions = true
  let strippedDimensions = false

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const body: Record<string, unknown> = {
      model: config.model,
      input: texts,
    }
    if (includeDimensions) {
      body.dimensions = EMBEDDING_DIMENSIONS
    }

    let response: Response
    try {
      response = await fetchImpl(embeddingsUrl(config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    } catch {
      if (attempt >= MAX_ATTEMPTS - 1) {
        throw new EmbeddingClientError("unavailable")
      }
      await sleep(BACKOFF_MS * 2 ** attempt)
      continue
    }

    if (response.ok) {
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new EmbeddingClientError("unavailable")
      }
      return vectorsFromPayload(payload, texts.length)
    }

    if (response.status === 401 || response.status === 403) {
      throw new EmbeddingClientError("invalid_config")
    }

    const errorText = await response.text()

    if (
      response.status === 400 &&
      includeDimensions &&
      !strippedDimensions &&
      mentionsDimensions(errorText)
    ) {
      includeDimensions = false
      strippedDimensions = true
      attempt -= 1
      continue
    }

    if (!isRetryableStatus(response.status) || attempt >= MAX_ATTEMPTS - 1) {
      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 422
      ) {
        throw new EmbeddingClientError("invalid_config")
      }
      throw new EmbeddingClientError("unavailable")
    }

    await sleep(BACKOFF_MS * 2 ** attempt)
  }

  throw new EmbeddingClientError("unavailable")
}

async function embedAgentPlanText(
  config: EmbeddingConfig,
  text: string,
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>
): Promise<number[]> {
  // 多模态接口把 input 里的片段合成一个向量，所以每段正文单独请求。
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const body = {
      model: config.model,
      input: [{ type: "text", text }],
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }

    let response: Response
    try {
      response = await fetchImpl(multimodalEmbeddingsUrl(config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    } catch {
      if (attempt >= MAX_ATTEMPTS - 1) {
        throw new EmbeddingClientError("unavailable")
      }
      await sleep(BACKOFF_MS * 2 ** attempt)
      continue
    }

    if (response.ok) {
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new EmbeddingClientError("unavailable")
      }
      return vectorFromMultimodalPayload(payload)
    }

    if (response.status === 401 || response.status === 403) {
      throw new EmbeddingClientError("invalid_config")
    }

    await response.text()
    if (!isRetryableStatus(response.status) || attempt >= MAX_ATTEMPTS - 1) {
      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 422
      ) {
        throw new EmbeddingClientError("invalid_config")
      }
      throw new EmbeddingClientError("unavailable")
    }

    await sleep(BACKOFF_MS * 2 ** attempt)
  }

  throw new EmbeddingClientError("unavailable")
}

export async function embedKnowledgeTexts(
  config: EmbeddingConfig,
  texts: string[],
  fetchImpl: typeof fetch,
  options?: EmbedOptions
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const sleep = options?.sleep ?? defaultSleep
  if (isAgentPlanVisionEmbedding(config)) {
    const vectors: number[][] = []
    for (const text of texts) {
      vectors.push(await embedAgentPlanText(config, text, fetchImpl, sleep))
    }
    return vectors
  }

  const vectors: number[][] = []
  for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
    const batch = texts.slice(offset, offset + BATCH_SIZE)
    const embedded = await embedBatch(config, batch, fetchImpl, sleep)
    vectors.push(...embedded)
  }
  return vectors
}

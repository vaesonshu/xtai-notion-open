import { describe, expect, it, vi } from "vitest"
import { DocumentsService } from "@api/documents/documents.service"
import {
  EmbeddingClientError,
  type EmbeddingConfig,
} from "@api/knowledge/embedding-client"
import { hashKnowledgeBody } from "@api/knowledge/content-hash"
import { KnowledgeIngestWorker } from "@api/knowledge/knowledge-ingest.worker"
import {
  CLAIM_NEXT_SQL,
  type KnowledgeIngestStore,
  type KnowledgeSourceRecord,
} from "@api/knowledge/knowledge-source.repository"
import type { EmbeddingSettings } from "@api/knowledge/knowledge.types"

const NOW = new Date("2026-10-29T12:00:00.000Z")
const LIBRARY_ID = "lib-1"
const BODY = "可索引正文一段"

type IngestChunk = {
  sourceId: string
  libraryId: string
  generation: number
  ordinal: number
  content: string
  heading: string | null
  page: number | null
  embedding: number[]
  embeddingRevision: number
}

type LibraryEmbedding = {
  revision: number
  settings: EmbeddingSettings
}

/** 内存仓库：claimNext 用 status 模拟 SKIP LOCKED，不连真实数据库。 */
class FakeIngestStore implements KnowledgeIngestStore {
  readonly rows: KnowledgeSourceRecord[] = []
  readonly chunks: IngestChunk[] = []
  readonly libraries = new Map<string, LibraryEmbedding>()

  async claimNext(): Promise<KnowledgeSourceRecord | null> {
    const queued = this.rows
      .filter((row) => row.status === "queued")
      .toSorted(
        (left, right) =>
          (left.updatedAt?.getTime() ?? 0) - (right.updatedAt?.getTime() ?? 0)
      )
    const row = queued[0]
    if (!row) {
      return null
    }
    row.status = "processing"
    row.lockedAt = NOW
    return { ...row }
  }

  async reclaimStale(olderThan: Date): Promise<number> {
    let count = 0
    for (const row of this.rows) {
      if (
        row.status === "processing" &&
        row.lockedAt &&
        row.lockedAt < olderThan
      ) {
        // 超时只解除领取，保留已解析正文，避免再下一遍 COS。
        row.status = "queued"
        row.lockedAt = null
        count += 1
      }
    }
    return count
  }

  async commitGeneration(input: {
    sourceId: string
    generation: number
    contentHash: string
    chunks: IngestChunk[]
  }): Promise<void> {
    const row = this.require(input.sourceId)
    this.chunks.splice(
      0,
      this.chunks.length,
      ...this.chunks.filter(
        (chunk) =>
          !(
            chunk.sourceId === input.sourceId &&
            chunk.generation !== input.generation
          )
      )
    )
    this.chunks.push(...input.chunks)
    row.activeGeneration = input.generation
    row.indexedContentHash = input.contentHash
    row.status = "ready"
    row.errorMessage = null
    row.lockedAt = null
  }

  async failSource(id: string, message: string): Promise<void> {
    const row = this.require(id)
    row.status = "failed"
    row.errorMessage = message
    row.lockedAt = null
  }

  async saveBodyText(id: string, bodyText: string): Promise<void> {
    this.require(id).bodyText = bodyText
  }

  async markReady(id: string): Promise<void> {
    const row = this.require(id)
    row.status = "ready"
    row.errorMessage = null
    row.lockedAt = null
  }

  async findLibraryEmbedding(
    libraryId: string
  ): Promise<LibraryEmbedding | null> {
    return this.libraries.get(libraryId) ?? null
  }

  async findActiveEmbeddingRevision(
    sourceId: string,
    generation: number
  ): Promise<number | null> {
    return (
      this.chunks.find(
        (chunk) =>
          chunk.sourceId === sourceId && chunk.generation === generation
      )?.embeddingRevision ?? null
    )
  }

  seed(row: KnowledgeSourceRecord) {
    this.rows.push({ ...row })
  }

  seedChunk(chunk: IngestChunk) {
    this.chunks.push({ ...chunk })
  }

  private require(id: string): KnowledgeSourceRecord {
    const row = this.rows.find((item) => item.id === id)
    if (!row) {
      throw new Error(`missing source ${id}`)
    }
    return row
  }
}

function sourceRecord(
  overrides: Partial<KnowledgeSourceRecord> = {}
): KnowledgeSourceRecord {
  return {
    id: "src-1",
    libraryId: LIBRARY_ID,
    kind: "file",
    title: "note.txt",
    status: "queued",
    errorMessage: null,
    activeGeneration: 0,
    indexedContentHash: null,
    bodyText: BODY,
    sourceDocumentId: null,
    storageKey: `knowledge/${LIBRARY_ID}/src-1/note.txt`,
    lockedAt: null,
    updatedAt: NOW,
    ...overrides,
  }
}

function oldChunk(overrides: Partial<IngestChunk> = {}): IngestChunk {
  return {
    sourceId: "src-1",
    libraryId: LIBRARY_ID,
    generation: 1,
    ordinal: 0,
    content: "旧分块",
    heading: null,
    page: null,
    embedding: [0.1],
    embeddingRevision: 1,
    ...overrides,
  }
}

function makeHarness(
  options: {
    source?: KnowledgeSourceRecord
    chunks?: IngestChunk[]
    revision?: number
    settings?: EmbeddingSettings
    embed?: (config: EmbeddingConfig, texts: string[]) => Promise<number[][]>
    parseFile?: (input: {
      filename: string
      bytes: Buffer
    }) => Promise<{ text: string; pages?: { page: number; text: string }[] }>
    getFile?: (storageKey: string) => Promise<Buffer>
    exportMarkdown?: (documentId: string, userId: string) => Promise<string>
  } = {}
) {
  const sources = new FakeIngestStore()
  sources.libraries.set(LIBRARY_ID, {
    revision: options.revision ?? 1,
    settings: options.settings ?? {
      openAiApiKey: "sk-test",
      openAiBaseUrl: "https://api.example.com/v1",
      openAiEmbeddingModel: "text-embedding-3-small",
    },
  })
  const source = options.source ?? sourceRecord()
  sources.seed(source)
  for (const chunk of options.chunks ?? []) {
    sources.seedChunk(chunk)
  }

  const embedTexts = vi.fn(
    options.embed ??
      (async (_config: EmbeddingConfig, texts: string[]) =>
        texts.map(() => [0.42]))
  )
  const parseFile = vi.fn(
    options.parseFile ??
      (async () => ({
        text: "解析正文",
      }))
  )
  const getFile = vi.fn(
    options.getFile ?? (async () => Buffer.from("file-bytes"))
  )
  const exportMarkdown = vi.fn(
    options.exportMarkdown ?? (async () => "# 活文档")
  )

  const worker = new KnowledgeIngestWorker(sources, {
    embedTexts,
    parseFile,
    getFile,
    exportMarkdown,
    now: () => NOW,
  })

  return {
    worker,
    sources,
    embedTexts,
    parseFile,
    getFile,
    exportMarkdown,
  }
}

describe("CLAIM_NEXT_SQL", () => {
  it("locks the next queued row with FOR UPDATE SKIP LOCKED", () => {
    expect(CLAIM_NEXT_SQL).toContain("FOR UPDATE SKIP LOCKED")
    expect(CLAIM_NEXT_SQL).toContain("status = 'queued'")
    expect(CLAIM_NEXT_SQL).toContain("ORDER BY updated_at")
  })
})

describe("KnowledgeIngestWorker.processNext", () => {
  it("skips embedding when hash and library revision both match", async () => {
    const hash = hashKnowledgeBody(BODY)
    const { worker, sources, embedTexts } = makeHarness({
      source: sourceRecord({
        activeGeneration: 1,
        indexedContentHash: hash,
      }),
      chunks: [oldChunk({ embeddingRevision: 1 })],
      revision: 1,
    })

    const claimed = await worker.processNext()

    expect(claimed).toBe(true)
    expect(embedTexts).toHaveBeenCalledTimes(0)
    expect(sources.rows[0]?.status).toBe("ready")
    expect(sources.rows[0]?.activeGeneration).toBe(1)
    expect(sources.chunks).toHaveLength(1)
  })

  it("embeds again when the library revision is newer", async () => {
    const hash = hashKnowledgeBody(BODY)
    const { worker, sources, embedTexts } = makeHarness({
      source: sourceRecord({
        activeGeneration: 1,
        indexedContentHash: hash,
      }),
      chunks: [oldChunk({ embeddingRevision: 1 })],
      revision: 2,
    })

    await worker.processNext()

    expect(embedTexts).toHaveBeenCalledTimes(1)
    expect(sources.rows[0]?.activeGeneration).toBe(2)
    expect(sources.chunks.every((chunk) => chunk.generation === 2)).toBe(true)
  })

  it("keeps the old generation when embedding fails", async () => {
    const { worker, sources, embedTexts } = makeHarness({
      source: sourceRecord({
        activeGeneration: 1,
        indexedContentHash: "old-hash",
        errorMessage: null,
      }),
      chunks: [oldChunk()],
      embed: async () => {
        throw new EmbeddingClientError("unavailable")
      },
    })

    await worker.processNext()

    expect(embedTexts).toHaveBeenCalledTimes(1)
    expect(sources.rows[0]?.status).toBe("failed")
    expect(sources.rows[0]?.errorMessage).toBe("嵌入服务暂时不可用")
    expect(sources.rows[0]?.activeGeneration).toBe(1)
    expect(sources.rows[0]?.bodyText).toBe(BODY)
    expect(sources.chunks).toEqual([oldChunk()])
  })

  it("maps invalid embedding config to 嵌入配置无效", async () => {
    const { worker, sources } = makeHarness({
      source: sourceRecord({ indexedContentHash: "old-hash" }),
      embed: async () => {
        throw new EmbeddingClientError("invalid_config")
      },
    })

    await worker.processNext()

    expect(sources.rows[0]?.errorMessage).toBe("嵌入配置无效")
  })

  it("maps bad_dimensions to 嵌入配置无效", async () => {
    const { worker, sources } = makeHarness({
      source: sourceRecord({ indexedContentHash: "old-hash" }),
      embed: async () => {
        throw new EmbeddingClientError("bad_dimensions")
      },
    })

    await worker.processNext()

    expect(sources.rows[0]?.errorMessage).toBe("嵌入配置无效")
  })

  it("commits a new generation and deletes older chunks", async () => {
    const { worker, sources, embedTexts } = makeHarness({
      source: sourceRecord({
        activeGeneration: 1,
        indexedContentHash: "old-hash",
        errorMessage: "嵌入服务暂时不可用",
      }),
      chunks: [oldChunk(), oldChunk({ ordinal: 1, content: "另一旧块" })],
    })

    await worker.processNext()

    expect(embedTexts).toHaveBeenCalledTimes(1)
    expect(sources.rows[0]?.status).toBe("ready")
    expect(sources.rows[0]?.activeGeneration).toBe(2)
    expect(sources.rows[0]?.errorMessage).toBeNull()
    expect(sources.rows[0]?.indexedContentHash).toBe(hashKnowledgeBody(BODY))
    expect(sources.chunks).toHaveLength(1)
    expect(sources.chunks[0]).toEqual(
      expect.objectContaining({
        generation: 2,
        sourceId: "src-1",
        content: BODY,
      })
    )
    expect(sources.chunks.some((chunk) => chunk.generation === 1)).toBe(false)
  })

  it("fails an empty document snapshot without exportMarkdown", async () => {
    const { worker, sources, embedTexts, exportMarkdown, parseFile, getFile } =
      makeHarness({
        source: sourceRecord({
          kind: "document_snapshot",
          title: "doc-1",
          bodyText: null,
          sourceDocumentId: "doc-1",
          storageKey: null,
        }),
      })

    await worker.processNext()

    expect(exportMarkdown).toHaveBeenCalledTimes(0)
    expect(parseFile).toHaveBeenCalledTimes(0)
    expect(getFile).toHaveBeenCalledTimes(0)
    expect(embedTexts).toHaveBeenCalledTimes(0)
    expect(sources.rows[0]?.status).toBe("failed")
    expect(sources.rows[0]?.errorMessage).toBe("缺少可索引正文")
  })

  it("does not open the live document when ingesting a snapshot", async () => {
    const exportSpy = vi.spyOn(DocumentsService.prototype, "exportMarkdown")
    const { worker, embedTexts, exportMarkdown } = makeHarness({
      source: sourceRecord({
        kind: "document_snapshot",
        title: "doc-1",
        bodyText: BODY,
        sourceDocumentId: "doc-1",
        storageKey: null,
      }),
    })

    await worker.processNext()

    expect(exportMarkdown).toHaveBeenCalledTimes(0)
    expect(exportSpy).toHaveBeenCalledTimes(0)
    expect(embedTexts).toHaveBeenCalledTimes(1)
    exportSpy.mockRestore()
  })

  it("parses an empty file, writes bodyText, then embeds", async () => {
    const bytes = Buffer.from("file-bytes")
    const { worker, sources, parseFile, getFile, embedTexts } = makeHarness({
      source: sourceRecord({
        title: "scan.pdf",
        bodyText: null,
        storageKey: "knowledge/lib-1/src-1/scan.pdf",
      }),
      parseFile: async () => ({
        text: "第一页\n第二页",
        pages: [
          { page: 2, text: "第一页" },
          { page: 3, text: "第二页" },
        ],
      }),
      getFile: async () => bytes,
    })

    await worker.processNext()

    expect(getFile).toHaveBeenCalledWith("knowledge/lib-1/src-1/scan.pdf")
    expect(parseFile).toHaveBeenCalledWith({
      filename: "scan.pdf",
      bytes,
    })
    expect(sources.rows[0]?.bodyText).toBe("第一页\n第二页")
    expect(embedTexts).toHaveBeenCalledTimes(1)
    const drafts = embedTexts.mock.calls[0]?.[1] as string[]
    expect(drafts.length).toBeGreaterThan(0)
    expect(sources.chunks.map((chunk) => chunk.page).toSorted()).toEqual([2, 3])
    const pageByContent = new Map(
      sources.chunks.map((chunk) => [chunk.content, chunk.page])
    )
    expect(pageByContent.get("第一页")).toBe(2)
    expect(pageByContent.get("第二页")).toBe(3)
  })

  it("fails when the object file is missing", async () => {
    const { worker, sources, parseFile, embedTexts } = makeHarness({
      source: sourceRecord({ bodyText: null }),
      getFile: async () => {
        throw new Error("NoSuchKey")
      },
    })

    await worker.processNext()

    expect(parseFile).toHaveBeenCalledTimes(0)
    expect(embedTexts).toHaveBeenCalledTimes(0)
    expect(sources.rows[0]?.errorMessage).toBe("对象文件不存在")
  })

  it("returns false when the queue is empty", async () => {
    const sources = new FakeIngestStore()
    const worker = new KnowledgeIngestWorker(sources, {
      embedTexts: async () => [],
      getFile: async () => Buffer.from(""),
      now: () => NOW,
    })

    await expect(worker.processNext()).resolves.toBe(false)
  })
})

describe("KnowledgeIngestWorker.reclaimStale", () => {
  it("returns processing older than 10 minutes to queued and keeps body_text", async () => {
    const lockedAt = new Date(NOW.getTime() - 11 * 60 * 1000)
    const { worker, sources, embedTexts } = makeHarness({
      source: sourceRecord({
        status: "processing",
        lockedAt,
        bodyText: "已解析正文",
      }),
    })

    const recovered = await worker.reclaimStale(NOW)

    expect(recovered).toBe(1)
    expect(sources.rows[0]?.status).toBe("queued")
    expect(sources.rows[0]?.bodyText).toBe("已解析正文")
    expect(embedTexts).toHaveBeenCalledTimes(0)
  })

  it("does not auto-retry failed sources", async () => {
    const lockedAt = new Date(NOW.getTime() - 30 * 60 * 1000)
    const { worker, sources } = makeHarness({
      source: sourceRecord({
        status: "failed",
        lockedAt,
        errorMessage: "嵌入服务暂时不可用",
        bodyText: BODY,
      }),
    })

    const recovered = await worker.reclaimStale(NOW)

    expect(recovered).toBe(0)
    expect(sources.rows[0]?.status).toBe("failed")
    await expect(worker.processNext()).resolves.toBe(false)
    expect(sources.rows[0]?.status).toBe("failed")
  })

  it("reclaims stale processing before claiming in processNext", async () => {
    const lockedAt = new Date(NOW.getTime() - 11 * 60 * 1000)
    const hash = hashKnowledgeBody(BODY)
    const { worker, sources, embedTexts } = makeHarness({
      source: sourceRecord({
        status: "processing",
        lockedAt,
        activeGeneration: 1,
        indexedContentHash: hash,
      }),
      chunks: [oldChunk({ embeddingRevision: 1 })],
    })

    const claimed = await worker.processNext()

    expect(claimed).toBe(true)
    expect(embedTexts).toHaveBeenCalledTimes(0)
    expect(sources.rows[0]?.status).toBe("ready")
  })
})

import { Test } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { AppModule } from "@api/app.module"
import { PrismaService } from "@api/database/prisma.module"
import type { PrismaClient } from "@api/generated/prisma/client"
import { KnowledgeSourceRepository } from "@api/knowledge/knowledge-source.repository"
import { EMBEDDING_DIMENSIONS } from "@api/knowledge/knowledge.types"

const REVISION = 1
const ACTIVE_GENERATION = 2
const STALE_GENERATION = 1

const TARGET_CONTENT = "target-ones-chunk"
const DISTRACTOR_CONTENT = "distractor-zeros-chunk"
const STALE_CONTENT = "stale-generation-ones-chunk"
const OTHER_LIBRARY_CONTENT = "other-library-ones-chunk"

function requireLocalDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL ?? ""
  // 只连本地库：远程 Neon 即使有 vector 也不算本任务的验收环境。
  if (!/localhost|127\.0\.0\.1/i.test(databaseUrl)) {
    throw new Error("vector search integration must use the local DATABASE_URL")
  }
}

function fillVector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value)
}

describe("pgvector knowledge chunk search (integration)", () => {
  let app: INestApplication
  let prisma: PrismaClient
  let sources: KnowledgeSourceRepository
  const libraryIds: string[] = []

  async function deleteInsertedRows(): Promise<void> {
    if (!prisma || libraryIds.length === 0) {
      return
    }
    // 删库会经来源级联清分块；库不可达时吞掉错误，避免掩盖真正的失败原因。
    try {
      await prisma.knowledgeLibrary.deleteMany({
        where: { id: { in: [...libraryIds] } },
      })
      libraryIds.length = 0
    } catch {
      // 本地 Postgres 没起来时行也插不进去，这里再删一次只会重复报连不上。
    }
  }

  async function insertStaleChunk(input: {
    libraryId: string
    sourceId: string
    content: string
    embedding: number[]
  }): Promise<void> {
    const vectorLiteral = `[${input.embedding.join(",")}]`
    await prisma.$executeRaw`
      INSERT INTO knowledge_chunk (
        library_id, source_id, generation, ordinal, content,
        heading, page, embedding, embedding_revision
      )
      VALUES (
        ${input.libraryId}::uuid,
        ${input.sourceId}::uuid,
        ${STALE_GENERATION},
        0,
        ${input.content},
        ${null},
        ${null},
        ${vectorLiteral}::vector,
        ${REVISION}
      )
    `
  }

  beforeAll(async () => {
    requireLocalDatabaseUrl()
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.listen(0)
    prisma = app.get(PrismaService).client
    sources = app.get(KnowledgeSourceRepository)
  })

  afterAll(async () => {
    try {
      await deleteInsertedRows()
    } finally {
      await app?.close()
    }
  })

  it("returns the all-ones target and excludes other-library and stale rows", async () => {
    const ones = fillVector(1)
    const zeros = fillVector(0)
    const libraryId = randomUUID()
    const otherLibraryId = randomUUID()
    const sourceId = randomUUID()
    const otherSourceId = randomUUID()
    libraryIds.push(libraryId, otherLibraryId)

    try {
      await prisma.knowledgeLibrary.create({
        data: {
          id: libraryId,
          name: "vector-search-lib",
          embeddingRevision: REVISION,
        },
      })
      await prisma.knowledgeLibrary.create({
        data: {
          id: otherLibraryId,
          name: "vector-search-other-lib",
          embeddingRevision: REVISION,
        },
      })

      await sources.insert({
        id: sourceId,
        libraryId,
        kind: "file",
        title: "vector-search-source",
        status: "ready",
        errorMessage: null,
        activeGeneration: 0,
        bodyText: null,
        sourceDocumentId: null,
        storageKey: null,
      })
      await sources.insert({
        id: otherSourceId,
        libraryId: otherLibraryId,
        kind: "file",
        title: "vector-search-other-source",
        status: "ready",
        errorMessage: null,
        activeGeneration: 0,
        bodyText: null,
        sourceDocumentId: null,
        storageKey: null,
      })

      // 干扰块用全 0：与全 1 查询正交，余弦距离最大，证明最近邻
      // 看的是向量距离而不是插入顺序。另一库写入相同的全 1 向量
      // 也必须被 library_id 过滤掉，避免把别人的资料当成当前库命中。
      await sources.commitGeneration({
        sourceId,
        generation: ACTIVE_GENERATION,
        contentHash: "vector-search-hash",
        chunks: [
          {
            sourceId,
            libraryId,
            generation: ACTIVE_GENERATION,
            ordinal: 0,
            content: TARGET_CONTENT,
            heading: null,
            page: null,
            embedding: ones,
            embeddingRevision: REVISION,
          },
          {
            sourceId,
            libraryId,
            generation: ACTIVE_GENERATION,
            ordinal: 1,
            content: DISTRACTOR_CONTENT,
            heading: null,
            page: null,
            embedding: zeros,
            embeddingRevision: REVISION,
          },
        ],
      })
      await insertStaleChunk({
        libraryId,
        sourceId,
        content: STALE_CONTENT,
        embedding: ones,
      })
      await sources.commitGeneration({
        sourceId: otherSourceId,
        generation: ACTIVE_GENERATION,
        contentHash: "vector-search-other-hash",
        chunks: [
          {
            sourceId: otherSourceId,
            libraryId: otherLibraryId,
            generation: ACTIVE_GENERATION,
            ordinal: 0,
            content: OTHER_LIBRARY_CONTENT,
            heading: null,
            page: null,
            embedding: ones,
            embeddingRevision: REVISION,
          },
        ],
      })

      // Task 10 方法名是 findNearestChunks，不是简报里的 searchChunks。
      const hits = await sources.findNearestChunks({
        libraryId,
        embeddingRevision: REVISION,
        embedding: ones,
      })
      const contents = hits.map((hit) => hit.content)

      expect(hits[0]?.content).toBe(TARGET_CONTENT)
      expect(hits[0]?.sourceId).toBe(sourceId)
      expect(hits[0]?.generation).toBe(ACTIVE_GENERATION)
      expect(contents).not.toContain(OTHER_LIBRARY_CONTENT)
      expect(contents).not.toContain(STALE_CONTENT)
    } finally {
      await deleteInsertedRows()
    }
  })
})

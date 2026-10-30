import { describe, expect, it, vi } from "vitest"
import type { PrismaService } from "@api/database/prisma.module"
import {
  KnowledgeSourceRepository,
  LOCK_LIBRARY_REVISION_SQL,
  type KnowledgeChunkInsert,
} from "@api/knowledge/knowledge-source.repository"

/** 交互事务把同一 client 当 tx 传入，便于断言 FOR UPDATE 与回滚排队。 */
function createPrisma() {
  const client = {
    knowledgeSource: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    knowledgeChunk: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(client)
    ),
  }
  return client
}

function makeRepo(
  prisma: ReturnType<typeof createPrisma>
): KnowledgeSourceRepository {
  return new KnowledgeSourceRepository({
    client: prisma,
  } as unknown as PrismaService)
}

function chunkInsert(
  overrides: Partial<KnowledgeChunkInsert> = {}
): KnowledgeChunkInsert {
  return {
    sourceId: "src-1",
    libraryId: "lib-1",
    generation: 2,
    ordinal: 0,
    content: "正文",
    heading: null,
    page: null,
    embedding: [0.1],
    embeddingRevision: 1,
    ...overrides,
  }
}

describe("LOCK_LIBRARY_REVISION_SQL", () => {
  it("locks the library row with FOR UPDATE", () => {
    expect(LOCK_LIBRARY_REVISION_SQL).toContain("FOR UPDATE")
    expect(LOCK_LIBRARY_REVISION_SQL).toContain("SELECT embedding_revision")
  })
})

describe("KnowledgeSourceRepository.commitGeneration", () => {
  it("does not publish when the locked revision does not match", async () => {
    const prisma = createPrisma()
    prisma.knowledgeSource.findUnique.mockResolvedValue({
      libraryId: "lib-1",
    })
    prisma.$queryRawUnsafe.mockResolvedValue([{ embedding_revision: 2 }])
    prisma.knowledgeSource.update.mockResolvedValue({})
    const repo = makeRepo(prisma)

    await repo.commitGeneration({
      sourceId: "src-1",
      generation: 2,
      contentHash: "new-hash",
      chunks: [chunkInsert({ embeddingRevision: 1 })],
    })

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      LOCK_LIBRARY_REVISION_SQL,
      "lib-1"
    )
    expect(LOCK_LIBRARY_REVISION_SQL).toContain("FOR UPDATE")
    expect(prisma.knowledgeSource.update).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: expect.objectContaining({
        status: "queued",
        lockedAt: null,
      }),
    })
    expect(
      prisma.knowledgeSource.update.mock.calls[0]?.[0]?.data
    ).not.toHaveProperty("activeGeneration")
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
    expect(prisma.knowledgeChunk.deleteMany).not.toHaveBeenCalled()
  })
})

describe("KnowledgeSourceRepository.markReady", () => {
  it("does not publish when the locked revision does not match", async () => {
    const prisma = createPrisma()
    prisma.knowledgeSource.findUnique.mockResolvedValue({
      libraryId: "lib-1",
      activeGeneration: 1,
    })
    prisma.$queryRawUnsafe.mockResolvedValue([{ embedding_revision: 2 }])
    prisma.knowledgeChunk.findFirst.mockResolvedValue({
      embeddingRevision: 1,
    })
    prisma.knowledgeSource.update.mockResolvedValue({})
    const repo = makeRepo(prisma)

    await repo.markReady("src-1")

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      LOCK_LIBRARY_REVISION_SQL,
      "lib-1"
    )
    expect(prisma.knowledgeSource.update).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: expect.objectContaining({
        status: "queued",
        lockedAt: null,
      }),
    })
    expect(
      prisma.knowledgeSource.update.mock.calls.some(
        (call) => call[0]?.data?.status === "ready"
      )
    ).toBe(false)
    expect(prisma.knowledgeChunk.deleteMany).not.toHaveBeenCalled()
  })
})

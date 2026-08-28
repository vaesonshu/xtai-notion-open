import { describe, expect, it, vi } from "vitest"
import type { PrismaService } from "@api/database/prisma.module"
import { ShareLinkRepository } from "@api/documents/share-link.repository"

// 构造最小可用的 Prisma mock；返回未断言类型的 client 以保留 vi.fn() 类型。
function createPrisma() {
  const client = {
    documentShareLink: { findFirst: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(client)
    ),
  }
  return client
}

function makeRepo(
  prisma: ReturnType<typeof createPrisma>
): ShareLinkRepository {
  // PrismaService 持有 client 属性；将 mock 包装成 { client } 后再断言为
  // PrismaService，保留 prisma.* 上的 vi.fn() mock 类型。
  return new ShareLinkRepository({
    client: prisma,
  } as unknown as PrismaService)
}

function camelLink(overrides: Record<string, unknown> = {}) {
  return {
    token: "token-1",
    documentId: "doc-1",
    createdBy: "user-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    revokedAt: null,
    ...overrides,
  }
}

const snakeRow = {
  token: "token-1",
  document_id: "doc-1",
  created_by: "user-1",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  revoked_at: null,
}

describe("ShareLinkRepository", () => {
  it("finds the active link for a document", async () => {
    const prisma = createPrisma()
    prisma.documentShareLink.findFirst.mockResolvedValue(camelLink())
    const repo = makeRepo(prisma)

    await expect(repo.findActiveByDocumentId("doc-1")).resolves.toEqual(snakeRow)
    expect(prisma.documentShareLink.findFirst).toHaveBeenCalledWith({
      where: { documentId: "doc-1", revokedAt: null },
    })
  })

  it("finds an active link by token and returns null when absent", async () => {
    const prisma = createPrisma()
    prisma.documentShareLink.findFirst.mockResolvedValue(null)
    const repo = makeRepo(prisma)

    await expect(repo.findActiveByToken("missing")).resolves.toBeNull()
    expect(prisma.documentShareLink.findFirst).toHaveBeenCalledWith({
      where: { token: "missing", revokedAt: null },
    })
  })

  it("creates a share link with parameterized values", async () => {
    const prisma = createPrisma()
    prisma.documentShareLink.create.mockResolvedValue(camelLink())
    const repo = makeRepo(prisma)

    await expect(repo.create("doc-1", "user-1", "token-1")).resolves.toEqual(
      snakeRow
    )
    expect(prisma.documentShareLink.create).toHaveBeenCalledWith({
      data: { token: "token-1", documentId: "doc-1", createdBy: "user-1" },
    })
  })

  it("promotes viewers while preserving owner and editor roles", async () => {
    const prisma = createPrisma()
    prisma.$queryRaw.mockResolvedValue([{ role: "editor" }])
    const repo = makeRepo(prisma)

    await expect(repo.upsertMemberAsEditor("doc-1", "user-2")).resolves.toBe(
      "editor"
    )
    // 事务内 $queryRaw 执行了 upsert；参数化值按顺序为 documentId、userId。
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const call = prisma.$queryRaw.mock.calls[0]?.[0] ?? ""
    expect(String(call)).toContain("ON CONFLICT (document_id, user_id)")
    expect(String(call)).toContain("WHEN document_member.role = 'viewer'")
  })
})
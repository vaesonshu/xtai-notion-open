import { describe, expect, it, vi } from "vitest"
import type { PrismaService } from "@api/database/prisma.module"
import { DocumentsRepository } from "@api/documents/documents.repository"

// 构造最小可用的 Prisma mock；每个用例按需覆写对应 model 方法。
// 返回未断言类型的 client，保留 vi.fn() 的 mock 方法；构造 repository 时再
// 转成 PrismaService，避免 cast 抹掉 mock 类型。
function createPrisma() {
  const client = {
    documentMember: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    workspace: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(client)
    ),
  }
  return client
}

function makeRepo(prisma: ReturnType<typeof createPrisma>): DocumentsRepository {
  // PrismaService 持有 client 属性；将 mock 包装成 { client } 后再断言为
  // PrismaService，保留 prisma.* 上的 vi.fn() mock 类型。
  return new DocumentsRepository({
    client: prisma,
  } as unknown as PrismaService)
}

function camelDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    workspaceId: "ws-1",
    title: "Demo",
    parentId: null,
    depth: 1,
    ownerId: "user-1",
    publicationStatus: "draft",
    rejectionReason: null,
    publishedAt: null,
    publishedBy: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  }
}

describe("DocumentsRepository", () => {
  it("getMemberRole returns role when membership exists", async () => {
    const prisma = createPrisma()
    prisma.documentMember.findFirst.mockResolvedValue({ role: "editor" })
    const repo = makeRepo(prisma)

    await expect(repo.getMemberRole("doc-1", "user-1")).resolves.toBe("editor")
    expect(prisma.documentMember.findFirst).toHaveBeenCalledWith({
      where: { documentId: "doc-1", userId: "user-1" },
      select: { role: true },
    })
  })

  it("getMemberRole returns null when user is not a member", async () => {
    const prisma = createPrisma()
    prisma.documentMember.findFirst.mockResolvedValue(null)
    const repo = makeRepo(prisma)

    await expect(repo.getMemberRole("doc-1", "stranger")).resolves.toBeNull()
  })

  it("findById returns document metadata row", async () => {
    const prisma = createPrisma()
    prisma.document.findFirst.mockResolvedValue(camelDocument())
    const repo = makeRepo(prisma)

    await expect(repo.findById("doc-1")).resolves.toEqual({
      id: "doc-1",
      workspace_id: "ws-1",
      title: "Demo",
      parent_id: null,
      depth: 1,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
      publication_status: "draft",
      rejection_reason: null,
      published_at: null,
      published_by: null,
    })
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-1", deletedAt: null },
    })
  })

  it("findById returns null when document is missing", async () => {
    const prisma = createPrisma()
    prisma.document.findFirst.mockResolvedValue(null)
    const repo = makeRepo(prisma)

    await expect(repo.findById("missing")).resolves.toBeNull()
  })

  it("createForOwner creates a workspace, document, and owner membership", async () => {
    const prisma = createPrisma()
    prisma.workspace.create.mockResolvedValue({ id: "ws-1" })
    prisma.document.create.mockResolvedValue(
      camelDocument({ title: "未命名文档" })
    )
    prisma.documentMember.create.mockResolvedValue({})
    const repo = makeRepo(prisma)

    await expect(repo.createForOwner("user-1")).resolves.toMatchObject({
      id: "doc-1",
      title: "未命名文档",
    })
    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: { name: "个人空间" },
    })
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws-1",
        title: "未命名文档",
        depth: 1,
        ownerId: "user-1",
      },
    })
    expect(prisma.documentMember.create).toHaveBeenCalledWith({
      data: { documentId: "doc-1", userId: "user-1", role: "owner" },
    })
  })
})
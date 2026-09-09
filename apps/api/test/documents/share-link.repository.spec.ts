import { NotFoundException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { PrismaService } from "@api/database/prisma.module"
import { ShareLinkRepository } from "@api/documents/share-link.repository"
import type { WorkspaceRepository } from "@api/workspaces/workspace.repository"

// 构造最小可用的 Prisma mock；返回未断言类型的 client 以保留 vi.fn() 类型。
function createPrisma() {
  const client = {
    documentShareLink: { findFirst: vi.fn(), create: vi.fn() },
    document: { findUnique: vi.fn() },
  }
  return client
}

function makeRepo(
  prisma: ReturnType<typeof createPrisma>,
  workspaces: Partial<WorkspaceRepository> = {}
): ShareLinkRepository {
  const workspaceRepo = {
    upsertMemberAsEditorForShareLink: vi.fn().mockResolvedValue("editor"),
    ...workspaces,
  } as unknown as WorkspaceRepository

  return new ShareLinkRepository(
    { client: prisma } as unknown as PrismaService,
    workspaceRepo
  )
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

  it("promotes viewers via workspace_member while preserving owner role", async () => {
    const prisma = createPrisma()
    prisma.document.findUnique.mockResolvedValue({ workspaceId: "ws-1" })
    const upsertMemberAsEditorForShareLink = vi.fn().mockResolvedValue("owner")
    const repo = makeRepo(prisma, { upsertMemberAsEditorForShareLink })

    await expect(repo.upsertMemberAsEditor("doc-1", "user-2")).resolves.toBe(
      "owner"
    )
    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      select: { workspaceId: true },
    })
    expect(upsertMemberAsEditorForShareLink).toHaveBeenCalledWith(
      "ws-1",
      "user-2"
    )
  })

  it("throws when the document does not exist", async () => {
    const prisma = createPrisma()
    prisma.document.findUnique.mockResolvedValue(null)
    const repo = makeRepo(prisma)

    await expect(repo.upsertMemberAsEditor("missing", "user-2")).rejects.toBeInstanceOf(
      NotFoundException
    )
  })
})

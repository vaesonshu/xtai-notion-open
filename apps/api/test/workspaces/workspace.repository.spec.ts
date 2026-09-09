import { describe, expect, it, vi } from "vitest"
import type { PrismaService } from "@api/database/prisma.module"
import { WorkspaceRepository } from "@api/workspaces/workspace.repository"

function createPrisma() {
  const client = {
    workspace: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workspaceMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(client)
    ),
  }
  return client
}

function makeRepo(prisma: ReturnType<typeof createPrisma>): WorkspaceRepository {
  return new WorkspaceRepository({
    client: prisma,
  } as unknown as PrismaService)
}

describe("WorkspaceRepository", () => {
  it("creates workspace and owner membership atomically", async () => {
    const prisma = createPrisma()
    prisma.workspace.create.mockResolvedValue({
      id: "ws-1",
      name: "产品知识库",
      createdBy: "user-1",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    })
    prisma.workspaceMember.create.mockResolvedValue({})
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: "owner" })
    prisma.workspaceMember.count.mockResolvedValue(1)
    const repo = makeRepo(prisma)

    const row = await repo.create("产品知识库", "user-1")
    expect(row.name).toBe("产品知识库")
    expect(await repo.getMemberRole(row.id, "user-1")).toBe("owner")
    expect(await repo.countMembers(row.id)).toBe(1)
  })

  it("lists workspaces for a member", async () => {
    const prisma = createPrisma()
    prisma.workspace.create.mockResolvedValue({
      id: "ws-1",
      name: "A",
      createdBy: "user-1",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    })
    prisma.workspaceMember.create.mockResolvedValue({})
    prisma.workspaceMember.findMany.mockResolvedValue([
      {
        role: "editor",
        workspace: {
          id: "ws-1",
          name: "A",
          createdBy: "user-1",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          _count: { members: 2, documents: 3 },
        },
      },
    ])
    const repo = makeRepo(prisma)

    await repo.create("A", "user-1")
    await repo.addMember("ws-1", "user-2", "editor")
    const list = await repo.listForUser("user-2")
    expect(list.map((item) => item.id)).toContain("ws-1")
  })

  it("upserts share-link membership into workspace_member without downgrading", async () => {
    const prisma = createPrisma()
    prisma.workspaceMember.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: "viewer" })
      .mockResolvedValueOnce({ role: "owner" })
    prisma.workspaceMember.create.mockResolvedValue({})
    prisma.workspaceMember.update.mockResolvedValue({})
    const repo = makeRepo(prisma)

    await expect(
      repo.upsertMemberAsEditorForShareLink("ws-1", "user-new")
    ).resolves.toBe("editor")
    expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
      data: { workspaceId: "ws-1", userId: "user-new", role: "editor" },
    })

    await expect(
      repo.upsertMemberAsEditorForShareLink("ws-1", "user-viewer")
    ).resolves.toBe("editor")
    expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: { workspaceId: "ws-1", userId: "user-viewer" },
      },
      data: { role: "editor" },
    })

    await expect(
      repo.upsertMemberAsEditorForShareLink("ws-1", "user-owner")
    ).resolves.toBe("owner")
    expect(prisma.workspaceMember.update).toHaveBeenCalledTimes(1)
  })
})

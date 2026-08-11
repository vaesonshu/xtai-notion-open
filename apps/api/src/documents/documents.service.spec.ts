import { ForbiddenException, NotFoundException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { DocumentsRepository } from "./documents.repository"
import { DocumentsService } from "./documents.service"

function createRepo(
  overrides: Partial<DocumentsRepository> = {}
): DocumentsRepository {
  return {
    getMemberRole: vi.fn(),
    findById: vi.fn(),
    ...overrides,
  } as unknown as DocumentsRepository
}

describe("DocumentsService", () => {
  it("getMemberRole delegates to repository", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue("viewer"),
    })
    const service = new DocumentsService(repo)

    await expect(service.getMemberRole("doc-1", "user-1")).resolves.toBe(
      "viewer"
    )
    expect(repo.getMemberRole).toHaveBeenCalledWith("doc-1", "user-1")
  })

  it("assertCanRead allows owner, editor, and viewer", async () => {
    for (const role of ["owner", "editor", "viewer"] as const) {
      const repo = createRepo({
        getMemberRole: vi.fn().mockResolvedValue(role),
      })
      const service = new DocumentsService(repo)
      await expect(service.assertCanRead("doc-1", "user-1")).resolves.toBe(role)
    }
  })

  it("assertCanRead rejects non-members with 403", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue(null),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.assertCanRead("doc-1", "stranger")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("assertCanWrite allows owner and editor", async () => {
    for (const role of ["owner", "editor"] as const) {
      const repo = createRepo({
        getMemberRole: vi.fn().mockResolvedValue(role),
      })
      const service = new DocumentsService(repo)
      await expect(service.assertCanWrite("doc-1", "user-1")).resolves.toBe(
        role
      )
    }
  })

  it("assertCanWrite rejects viewer with 403", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue("viewer"),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.assertCanWrite("doc-1", "viewer-1")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("assertCanWrite rejects non-members with 403", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue(null),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.assertCanWrite("doc-1", "stranger")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("getDocument returns metadata with role for members", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z")
    const updatedAt = new Date("2026-01-02T00:00:00.000Z")
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue("editor"),
      findById: vi.fn().mockResolvedValue({
        id: "doc-1",
        workspace_id: "ws-1",
        title: "Demo",
        created_at: createdAt,
        updated_at: updatedAt,
      }),
    })
    const service = new DocumentsService(repo)

    await expect(service.getDocument("doc-1", "user-1")).resolves.toEqual({
      id: "doc-1",
      workspaceId: "ws-1",
      title: "Demo",
      role: "editor",
      parentId: null,
      depth: 1,
      createdAt,
      updatedAt,
    })
  })

  it("getDocument rejects non-members with 403", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.getDocument("doc-1", "stranger")
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(repo.findById).not.toHaveBeenCalled()
  })

  it("getDocument throws NotFound when document row is missing", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue("owner"),
      findById: vi.fn().mockResolvedValue(null),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.getDocument("doc-1", "owner-1")
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it("createDocument returns owner metadata for the new document", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z")
    const repo = createRepo({
      createForOwner: vi.fn().mockResolvedValue({
        id: "doc-1",
        workspace_id: "ws-1",
        title: "未命名文档",
        created_at: createdAt,
        updated_at: createdAt,
      }),
    })
    const service = new DocumentsService(repo)

    await expect(service.createDocument("user-1")).resolves.toEqual({
      id: "doc-1",
      workspaceId: "ws-1",
      title: "未命名文档",
      role: "owner",
      parentId: null,
      depth: 1,
      createdAt,
      updatedAt: createdAt,
    })
    expect(repo.createForOwner).toHaveBeenCalledWith("user-1")
  })

  it("lists documents with each user's membership role", async () => {
    const repo = createRepo({
      listForUser: vi.fn().mockResolvedValue([
        {
          id: "owned",
          workspace_id: "ws-1",
          title: "Owned",
          role: "owner",
          created_at: new Date("2026-01-01"),
          updated_at: new Date("2026-01-02"),
        },
        {
          id: "shared",
          workspace_id: "ws-2",
          title: "Shared",
          role: "editor",
          created_at: new Date("2026-01-03"),
          updated_at: new Date("2026-01-04"),
        },
      ]),
    })
    const service = new DocumentsService(repo)

    await expect(service.listDocuments("user-1")).resolves.toEqual([
      expect.objectContaining({ id: "owned", role: "owner" }),
      expect.objectContaining({ id: "shared", role: "editor" }),
    ])
  })
})

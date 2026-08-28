import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import * as editorCore from "@xtai-notion/editor-core/server"
import type { DocumentsRepository } from "@api/documents/documents.repository"
import { DocumentsService } from "@api/documents/documents.service"
import type { UserRepository } from "@api/auth/user.repository"

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
      publicationStatus: "draft",
      rejectionReason: null,
      publishedAt: null,
      publishedBy: null,
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
      publicationStatus: "draft",
      rejectionReason: null,
      publishedAt: null,
      publishedBy: null,
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

  it("submits a draft document when the current member is an editor", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue("editor"),
      submitPublication: vi.fn().mockResolvedValue({
        id: "doc-1",
        workspace_id: "ws-1",
        title: "Draft",
        publication_status: "pending",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-02"),
      }),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.submitPublication("doc-1", "editor-1")
    ).resolves.toMatchObject({
      publicationStatus: "pending",
    })
    expect(repo.submitPublication).toHaveBeenCalledWith("doc-1")
  })

  it("rejects publication submission from a viewer", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue("viewer"),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.submitPublication("doc-1", "viewer-1")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("rejects a duplicate publication submission with a conflict", async () => {
    const repo = createRepo({
      getMemberRole: vi.fn().mockResolvedValue("owner"),
      submitPublication: vi.fn().mockResolvedValue(null),
    })
    const service = new DocumentsService(repo)

    await expect(
      service.submitPublication("doc-1", "owner-1")
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it("approves a pending document for an administrator", async () => {
    const repo = createRepo({
      approvePublication: vi.fn().mockResolvedValue({
        id: "doc-1",
        workspace_id: "ws-1",
        title: "Pending",
        publication_status: "published",
        published_at: new Date("2026-08-14"),
        published_by: "admin-1",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-08-14"),
      }),
    })
    const users = {
      findById: vi.fn().mockResolvedValue({ role: "admin" }),
    } as unknown as UserRepository
    const service = new DocumentsService(repo, users)

    await expect(
      service.approvePublication("doc-1", "admin-1")
    ).resolves.toMatchObject({
      publicationStatus: "published",
      publishedBy: "admin-1",
    })
  })

  it("does not allow a regular user to approve a document", async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({ role: "user" }),
    } as unknown as UserRepository
    const service = new DocumentsService(createRepo(), users)

    await expect(
      service.approvePublication("doc-1", "user-1")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("requires a non-empty reason when an administrator rejects a document", async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({ role: "admin" }),
    } as unknown as UserRepository
    const service = new DocumentsService(createRepo(), users)

    await expect(
      service.rejectPublication("doc-1", "admin-1", "  ")
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it("returns published article detail with content for the public square", async () => {
    const yDoc = { destroy: vi.fn() }
    vi.spyOn(editorCore, "documentFromYjs").mockReturnValue([
      {
        id: "block-1",
        type: "paragraph",
        props: {},
        content: [],
        children: [],
      },
    ])
    vi.spyOn(editorCore, "documentToPlainText").mockReturnValue("hello")
    const repo = createRepo({
      findPublishedById: vi.fn().mockResolvedValue({
        row: {
          id: "doc-1",
          workspace_id: "ws-1",
          title: "Published guide",
          publication_status: "published",
          published_at: new Date("2026-08-14T08:00:00.000Z"),
          created_at: new Date("2026-01-01"),
          updated_at: new Date("2026-08-14"),
        },
        authorName: "Ada",
        authorColor: "#24866B",
        workspaceName: "个人空间",
      }),
    })
    const persistence = {
      loadDocument: vi.fn().mockResolvedValue(yDoc),
    }
    const service = new DocumentsService(repo, undefined, persistence as never)

    await expect(service.getPublishedArticle("doc-1")).resolves.toMatchObject({
      id: "doc-1",
      title: "Published guide",
      author: "Ada",
      authorColor: "#24866B",
      category: "个人空间",
      content: [
        {
          id: "block-1",
          type: "paragraph",
          props: {},
          content: [],
          children: [],
        },
      ],
    })
    expect(persistence.loadDocument).toHaveBeenCalledWith("doc-1")
  })

  it("rejects unpublished article detail requests with 404", async () => {
    const repo = createRepo({
      findPublishedById: vi.fn().mockResolvedValue(null),
    })
    const service = new DocumentsService(repo, undefined, {
      loadDocument: vi.fn(),
    } as never)

    await expect(service.getPublishedArticle("missing")).rejects.toBeInstanceOf(
      NotFoundException
    )
  })

  it("aggregates mention links for the document graph", async () => {
    const yDoc = new Y.Doc()
    let loadCount = 0
    vi.spyOn(editorCore, "documentFromYjs").mockImplementation(() => {
      loadCount += 1
      if (loadCount === 1) {
        return [
          {
            id: "block-1",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "mention",
                id: "doc-2",
                label: "Other",
                href: "/documents/doc-2",
              },
            ],
            children: [],
          },
        ]
      }
      return [
        {
          id: "block-empty",
          type: "paragraph",
          props: {},
          content: [],
          children: [],
        },
      ]
    })
    const repo = createRepo({
      listForUser: vi.fn().mockResolvedValue([
        {
          id: "doc-1",
          workspace_id: "ws-1",
          title: "Source",
          role: "owner",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "doc-2",
          workspace_id: "ws-1",
          title: "Target",
          role: "owner",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: "doc-3",
          workspace_id: "ws-1",
          title: "Private",
          role: "owner",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]),
    })
    const persistence = {
      loadDocument: vi.fn().mockResolvedValue(yDoc),
    }
    const service = new DocumentsService(repo, undefined, persistence as never)

    await expect(service.listDocumentGraph("user-1")).resolves.toEqual([
      { id: "doc-1", title: "Source", links: ["doc-2"] },
      { id: "doc-2", title: "Target", links: [] },
      { id: "doc-3", title: "Private", links: [] },
    ])
  })
})

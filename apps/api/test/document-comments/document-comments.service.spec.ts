import {
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { DocumentsService } from "@api/documents/documents.service"
import { DocumentCommentsService } from "@api/document-comments/document-comments.service"
import type { DocumentCommentsRepository } from "@api/document-comments/document-comments.repository"

function createRepo(
  overrides: Partial<DocumentCommentsRepository> = {}
): DocumentCommentsRepository {
  return {
    listForDocument: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    ...overrides,
  } as unknown as DocumentCommentsRepository
}

function createDocuments(): DocumentsService {
  return {
    assertCanRead: vi.fn().mockResolvedValue("editor"),
  } as unknown as DocumentsService
}

describe("DocumentCommentsService", () => {
  it("listComments requires document membership", async () => {
    const documents = createDocuments()
    documents.assertCanRead = vi
      .fn()
      .mockRejectedValue(new ForbiddenException())
    const service = new DocumentCommentsService(createRepo(), documents)

    await expect(
      service.listComments("doc-1", "stranger")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("createComment requires blockId for root comments", async () => {
    const service = new DocumentCommentsService(
      createRepo(),
      createDocuments()
    )

    await expect(
      service.createComment("doc-1", "user-1", { body: "hi" })
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it("createComment persists anchored comment", async () => {
    const repo = createRepo({
      create: vi.fn().mockResolvedValue({
        id: "c-1",
        documentId: "doc-1",
        blockId: "block-1",
        parentId: null,
        depth: 0,
        body: "note",
        authorId: "user-1",
        authorName: "Alice",
        authorColor: "#000",
        createdAt: new Date(),
      }),
    })
    const service = new DocumentCommentsService(repo, createDocuments())

    const created = await service.createComment("doc-1", "user-1", {
      blockId: "block-1",
      body: "note",
    })

    expect(created.blockId).toBe("block-1")
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        blockId: "block-1",
        body: "note",
      })
    )
  })
})

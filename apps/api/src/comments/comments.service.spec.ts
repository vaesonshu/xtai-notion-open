import { BadRequestException, NotFoundException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import { CommentsService } from "./comments.service"
import type { CommentsRepository } from "./comments.repository"

function createRepository(
  overrides: Partial<CommentsRepository> = {}
): CommentsRepository {
  return {
    isPublishedArticle: vi.fn().mockResolvedValue(true),
    listForArticle: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    ...overrides,
  } as unknown as CommentsRepository
}

describe("CommentsService", () => {
  it("returns nested comment tree for published articles", async () => {
    const createdAt = new Date("2026-08-14T08:00:00.000Z")
    const repository = createRepository({
      listForArticle: vi.fn().mockResolvedValue([
        {
          id: "c1",
          articleId: "doc-1",
          parentId: null,
          depth: 0,
          body: "第一条",
          authorId: "u1",
          authorName: "Alice",
          authorColor: "#111111",
          createdAt,
        },
        {
          id: "c2",
          articleId: "doc-1",
          parentId: "c1",
          depth: 1,
          body: "回复第一条",
          authorId: "u2",
          authorName: "Bob",
          authorColor: "#222222",
          createdAt,
        },
      ]),
    })
    const service = new CommentsService(repository)

    await expect(service.listComments("doc-1")).resolves.toEqual([
      {
        id: "c1",
        articleId: "doc-1",
        parentId: null,
        depth: 0,
        body: "第一条",
        authorId: "u1",
        authorName: "Alice",
        authorColor: "#111111",
        createdAt,
        replies: [
          {
            id: "c2",
            articleId: "doc-1",
            parentId: "c1",
            depth: 1,
            body: "回复第一条",
            authorId: "u2",
            authorName: "Bob",
            authorColor: "#222222",
            createdAt,
            replies: [],
          },
        ],
      },
    ])
  })

  it("rejects comments on unpublished articles", async () => {
    const repository = createRepository({
      isPublishedArticle: vi.fn().mockResolvedValue(false),
    })
    const service = new CommentsService(repository)

    await expect(
      service.createComment("doc-1", "u1", { body: "hi" })
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it("rejects empty comment bodies", async () => {
    const service = new CommentsService(createRepository())

    await expect(
      service.createComment("doc-1", "u1", { body: "   " })
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it("creates nested replies with incremented depth", async () => {
    const createdAt = new Date("2026-08-15T08:00:00.000Z")
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue({
        id: "parent-1",
        articleId: "doc-1",
        parentId: null,
        depth: 1,
        body: "父评论",
        authorId: "u1",
        authorName: "Alice",
        authorColor: "#111111",
        createdAt,
      }),
      create: vi.fn().mockResolvedValue({
        id: "child-1",
        articleId: "doc-1",
        parentId: "parent-1",
        depth: 2,
        body: "子回复",
        authorId: "u2",
        authorName: "Bob",
        authorColor: "#222222",
        createdAt,
      }),
    })
    const service = new CommentsService(repository)

    await expect(
      service.createComment("doc-1", "u2", {
        body: "子回复",
        parentId: "parent-1",
      })
    ).resolves.toMatchObject({
      parentId: "parent-1",
      depth: 2,
      body: "子回复",
    })
    expect(repository.create).toHaveBeenCalledWith({
      articleId: "doc-1",
      userId: "u2",
      parentId: "parent-1",
      depth: 2,
      body: "子回复",
    })
  })

  it("rejects replies beyond max depth", async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue({
        id: "parent-1",
        articleId: "doc-1",
        parentId: "grand",
        depth: 3,
        body: "深层评论",
        authorId: "u1",
        authorName: "Alice",
        authorColor: "#111111",
        createdAt: new Date(),
      }),
    })
    const service = new CommentsService(repository)

    await expect(
      service.createComment("doc-1", "u2", {
        body: "太深了",
        parentId: "parent-1",
      })
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

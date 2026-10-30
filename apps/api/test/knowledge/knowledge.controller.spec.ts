import { BadRequestException, NotFoundException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import { KnowledgeController } from "@api/knowledge/knowledge.controller"

const USER = { id: "user-1" }
const LIBRARY_ID = "lib-1"
const SOURCE_ID = "src-1"

function createSseMocks() {
  const writes: string[] = []
  const response = {
    status: vi.fn(),
    setHeader: vi.fn(),
    writableEnded: false,
    write: (value: string) => writes.push(value),
    end: vi.fn(),
  }
  const request = { on: vi.fn() }
  return { writes, response, request }
}

function makeController(
  overrides: {
    libraries?: Record<string, unknown>
    sources?: Record<string, unknown>
    qa?: Record<string, unknown>
    cos?: Record<string, unknown>
  } = {}
) {
  return new KnowledgeController(
    (overrides.libraries ?? {}) as never,
    (overrides.sources ?? {}) as never,
    (overrides.qa ?? {}) as never,
    (overrides.cos ?? {}) as never
  )
}

describe("KnowledgeController", () => {
  it("POST /libraries trims the name before create", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ id: LIBRARY_ID, name: "产品资料" })
    const controller = makeController({ libraries: { create } })

    await controller.createLibrary(USER, { name: "  产品资料  " })

    expect(create).toHaveBeenCalledWith("user-1", "产品资料")
  })

  it("PUT /libraries/:id/embedding forwards the patch", async () => {
    const updateEmbedding = vi.fn().mockResolvedValue({
      openAiBaseUrl: "https://api.example.com/v1",
      openAiEmbeddingModel: "text-embedding-3-small",
      hasApiKey: true,
      modelChanged: false,
    })
    const controller = makeController({ libraries: { updateEmbedding } })
    const patch = { openAiEmbeddingModel: "text-embedding-3-small" }

    await controller.updateEmbedding(LIBRARY_ID, USER, patch)

    expect(updateEmbedding).toHaveBeenCalledWith("user-1", LIBRARY_ID, patch)
  })

  it("POST /libraries/:id/sources/file passes bytes and a knowledge prefix", async () => {
    const bytes = Buffer.from("hello knowledge")
    const recorded: Array<{
      userId: string
      libraryId: string
      filename: string
      bytes: Buffer
    }> = []
    const uploadFile = vi.fn(
      async (
        userId: string,
        libraryId: string,
        file: { filename: string; bytes: Buffer }
      ) => {
        recorded.push({
          userId,
          libraryId,
          filename: file.filename,
          bytes: file.bytes,
        })
        return { id: SOURCE_ID }
      }
    )
    const controller = makeController({ sources: { uploadFile } })

    await controller.uploadFile(
      LIBRARY_ID,
      { originalname: "notes.txt", buffer: bytes },
      undefined,
      USER
    )

    expect(recorded[0]?.bytes).toEqual(bytes)
    expect(recorded[0]?.filename).toBe("notes.txt")
    expect(`knowledge/${recorded[0]?.libraryId}/${SOURCE_ID}/`).toBe(
      "knowledge/lib-1/src-1/"
    )
    expect(uploadFile.mock.calls[0]?.[2]).not.toHaveProperty("storageKey")
  })

  it("POST /libraries/:id/sources/file uses UTF-8 filename field", async () => {
    const bytes = Buffer.from("hello")
    const uploadFile = vi.fn(async () => ({ id: SOURCE_ID }))
    const controller = makeController({ sources: { uploadFile } })
    const mojibake = Buffer.from("说明.txt", "utf8").toString("latin1")

    await controller.uploadFile(
      LIBRARY_ID,
      { originalname: mojibake, buffer: bytes },
      "说明.txt",
      USER
    )

    expect(uploadFile.mock.calls[0]?.[2]?.filename).toBe("说明.txt")
  })

  it("POST /libraries/:id/qa writes citations as SSE", async () => {
    const qa = {
      answer: vi.fn(async function* () {
        yield {
          type: "citations",
          citations: [],
          pendingSourceCount: 1,
        }
        yield { type: "token", content: "资料库里没有找到相关内容。" }
        yield { type: "done" }
      }),
    }
    const { writes, response, request } = createSseMocks()
    const controller = makeController({ qa })

    await controller.answerQuestion(
      LIBRARY_ID,
      { messages: [{ role: "user", content: "价格？" }] },
      USER,
      request,
      response
    )

    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream"
    )
    expect(writes.join("")).toContain("event: citations")
    expect(writes.join("")).toContain("event: token")
    expect(writes.join("")).toContain("event: done")
    expect(response.end).toHaveBeenCalled()
  })

  it("POST /libraries/:id/qa fails as HTTP before any SSE bytes", async () => {
    const qa = {
      answer: vi.fn(async function* () {
        throw new BadRequestException("请先配置资料库的嵌入模型")
      }),
    }
    const { writes, response, request } = createSseMocks()
    const controller = makeController({ qa })

    await expect(
      controller.answerQuestion(
        LIBRARY_ID,
        { messages: [{ role: "user", content: "价格？" }] },
        USER,
        request,
        response
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(response.setHeader).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it("GET /libraries/:id/sources/:sourceId/file uses fileOf", async () => {
    const fileOf = vi.fn().mockResolvedValue({
      storageKey: "knowledge/lib-1/src-1/notes.txt",
    })
    const getObject = vi.fn().mockResolvedValue(Buffer.from("notes"))
    const controller = makeController({
      sources: { fileOf },
      cos: { getObject },
    })

    await controller.downloadFile(LIBRARY_ID, SOURCE_ID, USER)

    expect(fileOf).toHaveBeenCalledWith("user-1", LIBRARY_ID, SOURCE_ID)
    expect(getObject).toHaveBeenCalledWith("knowledge/lib-1/src-1/notes.txt")
  })

  it("GET /libraries/:id/sources/:sourceId/file returns snapshot 404", async () => {
    const fileOf = vi
      .fn()
      .mockRejectedValue(new NotFoundException("原文件不存在"))
    const getObject = vi.fn()
    const controller = makeController({
      sources: { fileOf },
      cos: { getObject },
    })

    await expect(
      controller.downloadFile(LIBRARY_ID, SOURCE_ID, USER)
    ).rejects.toMatchObject({ message: "原文件不存在" })
    expect(getObject).not.toHaveBeenCalled()
  })

  it("DELETE /libraries/:id deletes COS objects before the database row", async () => {
    const order: string[] = []
    const fileStorageKeys = vi.fn(async () => {
      order.push("fileStorageKeys")
      return ["knowledge/lib-1/src-1/a.txt", "knowledge/lib-1/src-2/b.pdf"]
    })
    const deleteObject = vi.fn(async (key: string) => {
      order.push(`deleteObject:${key}`)
    })
    const deleteLibrary = vi.fn(async () => {
      order.push("deleteLibrary")
    })
    const controller = makeController({
      libraries: { fileStorageKeys, deleteLibrary },
      cos: { deleteObject },
    })

    await controller.deleteLibrary(LIBRARY_ID, USER)

    expect(order).toEqual([
      "fileStorageKeys",
      "deleteObject:knowledge/lib-1/src-1/a.txt",
      "deleteObject:knowledge/lib-1/src-2/b.pdf",
      "deleteLibrary",
    ])
  })

  it("DELETE /libraries/:id keeps the row when a COS delete fails", async () => {
    const deleteLibrary = vi.fn()
    const controller = makeController({
      libraries: {
        fileStorageKeys: vi
          .fn()
          .mockResolvedValue(["knowledge/lib-1/src-1/a.txt"]),
        deleteLibrary,
      },
      cos: {
        deleteObject: vi.fn().mockRejectedValue(new Error("COS unavailable")),
      },
    })

    await expect(controller.deleteLibrary(LIBRARY_ID, USER)).rejects.toThrow(
      "COS unavailable"
    )
    expect(deleteLibrary).not.toHaveBeenCalled()
  })

  it("DELETE /libraries/:id/sources/:sourceId deletes COS before the row", async () => {
    const order: string[] = []
    const fileOf = vi.fn(async () => {
      order.push("fileOf")
      return { storageKey: "knowledge/lib-1/src-1/a.txt" }
    })
    const deleteObject = vi.fn(async (key: string) => {
      order.push(`deleteObject:${key}`)
    })
    const deleteSource = vi.fn(async () => {
      order.push("deleteSource")
    })
    const controller = makeController({
      sources: { fileOf, deleteSource },
      cos: { deleteObject },
    })

    await controller.deleteSource(LIBRARY_ID, SOURCE_ID, USER)

    expect(order).toEqual([
      "fileOf",
      "deleteObject:knowledge/lib-1/src-1/a.txt",
      "deleteSource",
    ])
  })
})

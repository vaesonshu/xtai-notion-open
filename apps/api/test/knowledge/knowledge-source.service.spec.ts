import {
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import { KnowledgeLibraryService } from "@api/knowledge/knowledge-library.service"
import type { KnowledgeLibraryStore } from "@api/knowledge/knowledge-library.repository"
import { KnowledgeSourceService } from "@api/knowledge/knowledge-source.service"
import type {
  KnowledgeSourceRecord,
  KnowledgeSourceStore,
} from "@api/knowledge/knowledge-source.repository"
import * as parsers from "@api/knowledge/parsers"
import {
  MAX_KNOWLEDGE_FILE_BYTES,
  sourceStatusLabel,
  type EmbeddingSettings,
  type LibraryRole,
  type SourceStatus,
} from "@api/knowledge/knowledge.types"

const OWNER_ID = "owner-1"
const ADMIN_ID = "admin-1"
const EDITOR_ID = "editor-1"
const VIEWER_ID = "viewer-1"
const OUTSIDER_ID = "outsider-1"

type FakeLibrary = {
  id: string
  name: string
  embeddingSettings: EmbeddingSettings
  embeddingRevision: number
  updatedAt: Date
  members: Map<string, LibraryRole>
  storageKeys: string[]
}

/** 与 Task 6 相同的内存库：只提供成员校验，不掺进来源行。 */
class FakeKnowledgeLibraryRepository implements KnowledgeLibraryStore {
  readonly libraries = new Map<string, FakeLibrary>()

  async insertLibrary(userId: string, name: string) {
    const id = `lib-${this.libraries.size + 1}`
    const updatedAt = new Date("2026-10-29T00:00:00.000Z")
    this.libraries.set(id, {
      id,
      name,
      embeddingSettings: {},
      embeddingRevision: 1,
      updatedAt,
      members: new Map([[userId, "owner"]]),
      storageKeys: [],
    })
    return { id, name, updatedAt }
  }

  async listForUser(userId: string) {
    return [...this.libraries.values()]
      .filter((library) => library.members.has(userId))
      .map((library) => ({
        id: library.id,
        name: library.name,
        role: library.members.get(userId) ?? "viewer",
        sourceCount: 0,
        memberCount: library.members.size,
        updatedAt: library.updatedAt,
        embeddingSettings: library.embeddingSettings,
      }))
  }

  async requireMembership(libraryId: string, userId: string) {
    const library = this.libraries.get(libraryId)
    if (!library) {
      throw new NotFoundException("资料库不存在")
    }
    const role = library.members.get(userId)
    if (!role) {
      throw new ForbiddenException("无权访问该资料库")
    }
    return {
      role,
      name: library.name,
      embeddingSettings: library.embeddingSettings,
      embeddingRevision: library.embeddingRevision,
    }
  }

  async rename(libraryId: string, name: string) {
    this.requireLibrary(libraryId).name = name
  }

  async deleteLibrary(libraryId: string) {
    this.libraries.delete(libraryId)
  }

  async saveEmbedding(
    libraryId: string,
    settings: EmbeddingSettings,
    revision: number,
    _requeueSources = false
  ) {
    const library = this.requireLibrary(libraryId)
    library.embeddingSettings = settings
    library.embeddingRevision = revision
  }

  async listFileStorageKeys(libraryId: string) {
    return [...this.requireLibrary(libraryId).storageKeys]
  }

  async upsertMember(
    libraryId: string,
    userId: string,
    role: Exclude<LibraryRole, "owner">
  ) {
    this.requireLibrary(libraryId).members.set(userId, role)
  }

  async getMemberRole(libraryId: string, userId: string) {
    return this.requireLibrary(libraryId).members.get(userId) ?? null
  }

  async countOwners(libraryId: string) {
    return [...this.requireLibrary(libraryId).members.values()].filter(
      (role) => role === "owner"
    ).length
  }

  async removeMember(libraryId: string, userId: string) {
    this.requireLibrary(libraryId).members.delete(userId)
  }

  seedMember(libraryId: string, userId: string, role: LibraryRole) {
    this.requireLibrary(libraryId).members.set(userId, role)
  }

  private requireLibrary(libraryId: string): FakeLibrary {
    const library = this.libraries.get(libraryId)
    if (!library) {
      throw new NotFoundException("资料库不存在")
    }
    return library
  }
}

class FakeKnowledgeSourceRepository implements KnowledgeSourceStore {
  readonly rows: KnowledgeSourceRecord[] = []

  async insert(row: KnowledgeSourceRecord): Promise<KnowledgeSourceRecord> {
    this.rows.push({ ...row })
    return { ...row }
  }

  async listByLibrary(libraryId: string): Promise<KnowledgeSourceRecord[]> {
    return this.rows.filter((row) => row.libraryId === libraryId)
  }

  async findById(
    libraryId: string,
    sourceId: string
  ): Promise<KnowledgeSourceRecord | null> {
    return (
      this.rows.find(
        (row) => row.libraryId === libraryId && row.id === sourceId
      ) ?? null
    )
  }

  async findSnapshot(
    libraryId: string,
    documentId: string
  ): Promise<KnowledgeSourceRecord | null> {
    return (
      this.rows.find(
        (row) =>
          row.libraryId === libraryId &&
          row.kind === "document_snapshot" &&
          row.sourceDocumentId === documentId
      ) ?? null
    )
  }

  async updateBodyAndQueue(
    sourceId: string,
    bodyText: string | null,
    title?: string
  ): Promise<void> {
    const row = this.rows.find((item) => item.id === sourceId)
    if (!row) {
      return
    }
    row.bodyText = bodyText
    row.status = "queued"
    if (title !== undefined) {
      row.title = title
    }
  }

  async deleteById(libraryId: string, sourceId: string): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.libraryId === libraryId && row.id === sourceId
    )
    if (index >= 0) {
      this.rows.splice(index, 1)
    }
  }

  seed(row: KnowledgeSourceRecord) {
    this.rows.push({ ...row })
  }
}

class FakeDocuments {
  calls: { documentId: string; userId: string }[] = []
  titleCalls: { documentId: string; userId: string }[] = []
  markdown = "# 导入正文"
  title = "产品手册"
  denyRead = false
  throwOnExport = false

  async readTitle(documentId: string, userId: string): Promise<string> {
    this.titleCalls.push({ documentId, userId })
    if (this.denyRead) {
      throw new ForbiddenException("无权阅读该文档")
    }
    return this.title
  }

  async exportMarkdown(documentId: string, userId: string): Promise<string> {
    this.calls.push({ documentId, userId })
    if (this.denyRead || this.throwOnExport) {
      throw new ForbiddenException("无权阅读该文档")
    }
    return this.markdown
  }
}

function makeHarness() {
  const libraryRepo = new FakeKnowledgeLibraryRepository()
  const libraries = new KnowledgeLibraryService(libraryRepo, {
    findById: async () => null,
    findByEmail: async () => null,
  })
  const sources = new FakeKnowledgeSourceRepository()
  const documents = new FakeDocuments()
  const putCalls: { storageKey: string; bytes: Buffer }[] = []
  const putFile = async (storageKey: string, bytes: Buffer) => {
    putCalls.push({ storageKey, bytes })
  }
  const service = new KnowledgeSourceService(
    libraries,
    sources,
    documents,
    putFile
  )
  return {
    service,
    libraries,
    libraryRepo,
    sources,
    documents,
    putCalls,
  }
}

async function seedLibrary(libraryRepo: FakeKnowledgeLibraryRepository) {
  const libraries = new KnowledgeLibraryService(libraryRepo, {
    findById: async () => null,
    findByEmail: async () => null,
  })
  const library = await libraries.create(OWNER_ID, "产品资料")
  libraryRepo.seedMember(library.id, VIEWER_ID, "viewer")
  libraryRepo.seedMember(library.id, EDITOR_ID, "editor")
  libraryRepo.seedMember(library.id, ADMIN_ID, "admin")
  return library
}

function fileRecord(
  libraryId: string,
  overrides: Partial<KnowledgeSourceRecord> = {}
): KnowledgeSourceRecord {
  return {
    id: "file-1",
    libraryId,
    kind: "file",
    title: "note.txt",
    status: "ready",
    errorMessage: null,
    activeGeneration: 1,
    bodyText: "旧文件正文",
    sourceDocumentId: null,
    storageKey: `knowledge/${libraryId}/file-1/note.txt`,
    ...overrides,
  }
}

function snapshotRecord(
  libraryId: string,
  overrides: Partial<KnowledgeSourceRecord> = {}
): KnowledgeSourceRecord {
  return {
    id: "snap-1",
    libraryId,
    kind: "document_snapshot",
    title: "doc-1",
    status: "ready",
    errorMessage: null,
    activeGeneration: 1,
    bodyText: "旧快照正文",
    sourceDocumentId: "doc-1",
    storageKey: null,
    ...overrides,
  }
}

describe("KnowledgeLibraryService.requireRole", () => {
  it("rejects a viewer when editor is required", async () => {
    const { libraries, libraryRepo } = makeHarness()
    const library = await seedLibrary(libraryRepo)

    await expect(
      libraries.requireRole(VIEWER_ID, library.id, "editor")
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      libraries.requireRole(VIEWER_ID, library.id, "editor")
    ).rejects.toThrow("查看者无法修改资料库")
  })

  it("keeps Task 6 copy for higher management denials", async () => {
    const { libraries, libraryRepo } = makeHarness()
    const library = await seedLibrary(libraryRepo)

    await expect(
      libraries.requireRole(ADMIN_ID, library.id, "owner")
    ).rejects.toThrow("无权管理该资料库")
    await expect(
      libraries.requireRole(EDITOR_ID, library.id, "admin")
    ).rejects.toThrow("无权管理该资料库")
  })

  it("keeps missing-library and non-member copy from Task 6", async () => {
    const { libraries, libraryRepo } = makeHarness()
    const library = await seedLibrary(libraryRepo)

    await expect(
      libraries.requireRole(OWNER_ID, "missing-lib", "editor")
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      libraries.requireRole(OWNER_ID, "missing-lib", "editor")
    ).rejects.toThrow("资料库不存在")
    await expect(
      libraries.requireRole(OUTSIDER_ID, library.id, "editor")
    ).rejects.toThrow("无权访问该资料库")
  })
})

describe("KnowledgeSourceService.uploadFile", () => {
  it("forbids a viewer and does not insert", async () => {
    const { service, libraryRepo, sources, putCalls } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    const bytes = Buffer.from("hello", "utf8")

    await expect(
      service.uploadFile(VIEWER_ID, library.id, {
        filename: "note.txt",
        bytes,
      })
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      service.uploadFile(VIEWER_ID, library.id, {
        filename: "note.txt",
        bytes,
      })
    ).rejects.toThrow("查看者无法修改资料库")
    expect(sources.rows).toHaveLength(0)
    expect(putCalls).toHaveLength(0)
  })

  it("puts a legal txt then inserts a queued file with null bodyText", async () => {
    const { service, libraryRepo, sources, putCalls } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    const bytes = Buffer.from("hello", "utf8")

    const created = await service.uploadFile(OWNER_ID, library.id, {
      filename: "note.txt",
      bytes,
    })

    expect(putCalls).toEqual([
      {
        storageKey: `knowledge/${library.id}/${created.id}/note.txt`,
        bytes,
      },
    ])
    expect(sources.rows).toHaveLength(1)
    expect(sources.rows[0]).toEqual(
      expect.objectContaining({
        id: created.id,
        libraryId: library.id,
        kind: "file",
        status: "queued",
        bodyText: null,
        storageKey: `knowledge/${library.id}/${created.id}/note.txt`,
      })
    )
  })

  it("does not insert an illegal extension", async () => {
    const { service, libraryRepo, sources, putCalls } = makeHarness()
    const library = await seedLibrary(libraryRepo)

    await expect(
      service.uploadFile(OWNER_ID, library.id, {
        filename: "notes.exe",
        bytes: Buffer.from("nope", "utf8"),
      })
    ).rejects.toThrow("只支持 txt、md、pdf、docx 文件")
    expect(sources.rows).toHaveLength(0)
    expect(putCalls).toHaveLength(0)
  })

  it("rejects files over 20MB before COS and does not insert", async () => {
    const { service, libraryRepo, sources, putCalls } = makeHarness()
    const library = await seedLibrary(libraryRepo)

    await expect(
      service.uploadFile(OWNER_ID, library.id, {
        filename: "big.txt",
        bytes: Buffer.alloc(MAX_KNOWLEDGE_FILE_BYTES + 1),
      })
    ).rejects.toBeInstanceOf(PayloadTooLargeException)
    await expect(
      service.uploadFile(OWNER_ID, library.id, {
        filename: "big.txt",
        bytes: Buffer.alloc(MAX_KNOWLEDGE_FILE_BYTES + 1),
      })
    ).rejects.toThrow("文件不能超过 20MB")
    expect(sources.rows).toHaveLength(0)
    expect(putCalls).toHaveLength(0)
  })
})

describe("KnowledgeSourceService.importDocument", () => {
  it("exports markdown once and inserts a snapshot with that body", async () => {
    const { service, libraryRepo, sources, documents } = makeHarness()
    const library = await seedLibrary(libraryRepo)

    const created = await service.importDocument(OWNER_ID, library.id, "doc-1")

    expect(documents.calls).toEqual([{ documentId: "doc-1", userId: OWNER_ID }])
    expect(sources.rows).toHaveLength(1)
    expect(sources.rows[0]).toEqual(
      expect.objectContaining({
        id: created.id,
        kind: "document_snapshot",
        status: "queued",
        bodyText: "# 导入正文",
        sourceDocumentId: "doc-1",
      })
    )
  })

  it("stores the document title instead of the document id", async () => {
    const { service, libraryRepo, sources } = makeHarness()
    const library = await seedLibrary(libraryRepo)

    await service.importDocument(OWNER_ID, library.id, "doc-1")

    expect(sources.rows[0]?.title).toBe("产品手册")
    expect(sources.rows[0]?.title).not.toBe("doc-1")
  })

  it("overwrites bodyText and requeues the same snapshot row", async () => {
    const { service, libraryRepo, sources, documents } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    const first = await service.importDocument(OWNER_ID, library.id, "doc-1")
    documents.markdown = "# 第二版"

    const second = await service.importDocument(OWNER_ID, library.id, "doc-1")

    expect(second.id).toBe(first.id)
    expect(sources.rows).toHaveLength(1)
    expect(sources.rows[0]?.bodyText).toBe("# 第二版")
    expect(sources.rows[0]?.status).toBe("queued")
  })

  it("updates the stored title when re-importing", async () => {
    const { service, libraryRepo, sources, documents } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    await service.importDocument(OWNER_ID, library.id, "doc-1")
    documents.title = "改名后的手册"
    documents.markdown = "# 第二版"

    await service.importDocument(OWNER_ID, library.id, "doc-1")

    expect(sources.rows).toHaveLength(1)
    expect(sources.rows[0]?.title).toBe("改名后的手册")
    expect(sources.rows[0]?.bodyText).toBe("# 第二版")
  })

  it("leaves the snapshot unchanged when exportMarkdown throws", async () => {
    const { service, libraryRepo, sources, documents } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    await service.importDocument(OWNER_ID, library.id, "doc-1")
    documents.title = "不该写进去"
    documents.markdown = "# 不该写进去"
    documents.throwOnExport = true

    await expect(
      service.importDocument(OWNER_ID, library.id, "doc-1")
    ).rejects.toThrow("无权阅读该文档")
    expect(sources.rows).toHaveLength(1)
    expect(sources.rows[0]?.title).toBe("产品手册")
    expect(sources.rows[0]?.bodyText).toBe("# 导入正文")
    expect(sources.rows[0]?.status).toBe("queued")
  })
})

describe("KnowledgeSourceService.reindex", () => {
  it("clears file bodyText and queues without exporting markdown", async () => {
    const { service, libraryRepo, sources, documents } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    sources.seed(fileRecord(library.id))

    await service.reindex(OWNER_ID, library.id, "file-1")

    expect(documents.calls).toHaveLength(0)
    expect(documents.titleCalls).toHaveLength(0)
    expect(sources.rows[0]?.bodyText).toBeNull()
    expect(sources.rows[0]?.status).toBe("queued")
    expect(sources.rows[0]?.title).toBe("note.txt")
  })

  it("exports markdown again when reindexing a snapshot", async () => {
    const { service, libraryRepo, sources, documents } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    sources.seed(snapshotRecord(library.id))
    documents.markdown = "# 新快照"
    documents.title = "更新后的标题"

    await service.reindex(OWNER_ID, library.id, "snap-1")

    expect(documents.calls).toEqual([{ documentId: "doc-1", userId: OWNER_ID }])
    expect(sources.rows[0]?.bodyText).toBe("# 新快照")
    expect(sources.rows[0]?.status).toBe("queued")
    expect(sources.rows[0]?.title).toBe("更新后的标题")
  })

  it("does not change the row when exportMarkdown denies read", async () => {
    const { service, libraryRepo, sources, documents } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    sources.seed(
      snapshotRecord(library.id, {
        status: "ready" as SourceStatus,
        bodyText: "旧快照正文",
      })
    )
    documents.denyRead = true

    await expect(
      service.reindex(OWNER_ID, library.id, "snap-1")
    ).rejects.toThrow("无权阅读该文档")
    expect(sources.rows[0]?.status).toBe("ready")
    expect(sources.rows[0]?.bodyText).toBe("旧快照正文")
    expect(sources.rows[0]?.title).toBe("doc-1")
  })
})

describe("KnowledgeSourceService.list", () => {
  it("omits bodyText and uses sourceStatusLabel", async () => {
    const { service, libraryRepo, sources } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    sources.seed(
      fileRecord(library.id, {
        id: "queued-file",
        status: "queued",
        activeGeneration: 0,
        bodyText: "不该出现在列表",
      })
    )
    sources.seed(
      snapshotRecord(library.id, {
        id: "failed-snap",
        status: "failed",
        activeGeneration: 2,
        bodyText: "快照正文",
      })
    )

    const items = await service.list(VIEWER_ID, library.id)

    expect(items).toEqual([
      expect.objectContaining({
        id: "queued-file",
        status: "queued",
        statusLabel: sourceStatusLabel("queued", 0),
        activeGeneration: 0,
      }),
      expect.objectContaining({
        id: "failed-snap",
        status: "failed",
        statusLabel: sourceStatusLabel("failed", 2),
        activeGeneration: 2,
      }),
    ])
    expect(items[0]).not.toHaveProperty("bodyText")
    expect(items[1]).not.toHaveProperty("bodyText")
  })
})

describe("KnowledgeSourceService.fileOf", () => {
  it("forbids a viewer from reading the original file key", async () => {
    const { service, libraryRepo, sources } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    sources.seed(fileRecord(library.id))

    await expect(
      service.fileOf(VIEWER_ID, library.id, "file-1")
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      service.fileOf(VIEWER_ID, library.id, "file-1")
    ).rejects.toThrow("查看者无法修改资料库")
  })

  it("returns 原文件不存在 for a snapshot instead of 资料库不存在", async () => {
    const { service, libraryRepo, sources } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    sources.seed(snapshotRecord(library.id))

    await expect(
      service.fileOf(OWNER_ID, library.id, "snap-1")
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      service.fileOf(OWNER_ID, library.id, "snap-1")
    ).rejects.toThrow("原文件不存在")
    await expect(
      service.fileOf(OWNER_ID, library.id, "snap-1")
    ).rejects.not.toThrow("资料库不存在")
  })

  it("returns storageKey for a file source", async () => {
    const { service, libraryRepo, sources } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    const stored = fileRecord(library.id)
    sources.seed(stored)

    await expect(
      service.fileOf(EDITOR_ID, library.id, "file-1")
    ).resolves.toEqual({ storageKey: stored.storageKey })
  })
})

describe("KnowledgeSourceService.deleteSource", () => {
  it("deletes the database row and does not call COS", async () => {
    const { service, libraryRepo, sources, putCalls } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    sources.seed(fileRecord(library.id))

    await service.deleteSource(OWNER_ID, library.id, "file-1")

    expect(sources.rows).toHaveLength(0)
    expect(putCalls).toHaveLength(0)
  })
})

describe("KnowledgeSourceService parsing", () => {
  it("does not call parseKnowledgeFile while uploading", async () => {
    const { service, libraryRepo } = makeHarness()
    const library = await seedLibrary(libraryRepo)
    const spy = vi.spyOn(parsers, "parseKnowledgeFile")

    await service.uploadFile(OWNER_ID, library.id, {
      filename: "note.txt",
      bytes: Buffer.from("hello", "utf8"),
    })

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

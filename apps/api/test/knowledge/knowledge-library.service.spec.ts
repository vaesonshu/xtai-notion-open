import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { KnowledgeLibraryService } from "@api/knowledge/knowledge-library.service"
import type {
  EmbeddingSettings,
  LibraryRole,
} from "@api/knowledge/knowledge.types"
import type { KnowledgeLibraryStore } from "@api/knowledge/knowledge-library.repository"

const OWNER_ID = "owner-1"
const ADMIN_ID = "admin-1"
const VIEWER_ID = "viewer-1"
const OUTSIDER_ID = "outsider-1"
const MEMBER_ID = "member-1"

type FakeLibrary = {
  id: string
  name: string
  embeddingSettings: EmbeddingSettings
  embeddingRevision: number
  updatedAt: Date
  members: Map<string, LibraryRole>
  storageKeys: string[]
}

/** 内存假仓库：只服务本文件，用来锁住 service 的权限与排队副作用。 */
class FakeKnowledgeLibraryRepository implements KnowledgeLibraryStore {
  readonly libraries = new Map<string, FakeLibrary>()
  markAllSourcesQueuedCalls = 0

  async insertLibrary(
    userId: string,
    name: string
  ): Promise<{ id: string; name: string; updatedAt: Date }> {
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
    const library = this.requireLibrary(libraryId)
    library.name = name
    library.updatedAt = new Date()
  }

  async deleteLibrary(libraryId: string) {
    this.libraries.delete(libraryId)
  }

  async saveEmbedding(
    libraryId: string,
    settings: EmbeddingSettings,
    revision: number,
    requeueSources = false
  ) {
    const library = this.requireLibrary(libraryId)
    library.embeddingSettings = settings
    library.embeddingRevision = revision
    if (requeueSources) {
      this.markAllSourcesQueuedCalls += 1
    }
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

class FakeUsers {
  private readonly byId = new Map<string, { id: string; email: string }>()
  private readonly byEmail = new Map<string, { id: string; email: string }>()

  add(user: { id: string; email: string }) {
    this.byId.set(user.id, user)
    this.byEmail.set(user.email, user)
  }

  async findById(id: string) {
    return this.byId.get(id) ?? null
  }

  async findByEmail(email: string) {
    return this.byEmail.get(email) ?? null
  }
}

function makeService() {
  const repo = new FakeKnowledgeLibraryRepository()
  const users = new FakeUsers()
  users.add({ id: MEMBER_ID, email: "member@example.com" })
  const service = new KnowledgeLibraryService(repo, users)
  return { service, repo, users }
}

async function createOwnedLibrary(
  service: KnowledgeLibraryService,
  name = "产品资料"
) {
  return service.create(OWNER_ID, name)
}

describe("KnowledgeLibraryService", () => {
  it("rejects a blank library name", async () => {
    const { service } = makeService()

    await expect(service.create(OWNER_ID, "  ")).rejects.toBeInstanceOf(
      BadRequestException
    )
    await expect(service.create(OWNER_ID, "  ")).rejects.toThrow(
      "资料库名称不能为空"
    )
  })

  it("rejects a name longer than 80 characters", async () => {
    const { service } = makeService()
    const tooLong = "测".repeat(81)

    await expect(service.create(OWNER_ID, tooLong)).rejects.toBeInstanceOf(
      BadRequestException
    )
    await expect(service.create(OWNER_ID, tooLong)).rejects.toThrow(
      "资料库名称不能超过 80 字"
    )
  })

  it("creates the actor as the sole owner", async () => {
    const { service, repo } = makeService()

    const created = await service.create(OWNER_ID, "  产品资料  ")
    const stored = repo.libraries.get(created.id)

    expect(created.name).toBe("产品资料")
    expect(created.role).toBe("owner")
    expect(created.memberCount).toBe(1)
    expect(created.embeddingConfigured).toBe(false)
    expect(stored?.members.get(OWNER_ID)).toBe("owner")
    expect(stored?.members.size).toBe(1)
  })

  it("sets embeddingConfigured only when key and model are stored", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)
    const stored = repo.libraries.get(library.id)
    if (!stored) {
      throw new Error("missing library")
    }

    stored.embeddingSettings = { openAiApiKey: "sk-secret" }
    expect((await service.list(OWNER_ID))[0]?.embeddingConfigured).toBe(false)

    stored.embeddingSettings = {
      openAiEmbeddingModel: "text-embedding-3-small",
    }
    expect((await service.list(OWNER_ID))[0]?.embeddingConfigured).toBe(false)

    stored.embeddingSettings = {
      openAiApiKey: "sk-secret",
      openAiEmbeddingModel: "text-embedding-3-small",
    }
    const listed = await service.list(OWNER_ID)
    expect(listed[0]?.embeddingConfigured).toBe(true)
    expect(listed[0]).not.toHaveProperty("openAiApiKey")
    expect(JSON.stringify(listed)).not.toContain("sk-secret")
  })

  it("forbids viewer and admin from renaming", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)
    repo.seedMember(library.id, VIEWER_ID, "viewer")
    repo.seedMember(library.id, ADMIN_ID, "admin")

    await expect(
      service.rename(VIEWER_ID, library.id, "新名称")
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      service.rename(VIEWER_ID, library.id, "新名称")
    ).rejects.toThrow("无权管理该资料库")
    await expect(
      service.rename(ADMIN_ID, library.id, "新名称")
    ).rejects.toThrow("无权管理该资料库")
  })

  it("lets the owner rename a library", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)

    await service.rename(OWNER_ID, library.id, "  新名称  ")

    expect(repo.libraries.get(library.id)?.name).toBe("新名称")
  })

  it("forbids admin from changing embedding settings", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)
    repo.seedMember(library.id, ADMIN_ID, "admin")

    await expect(
      service.updateEmbedding(ADMIN_ID, library.id, {
        openAiApiKey: "sk-new",
      })
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      service.updateEmbedding(ADMIN_ID, library.id, {
        openAiApiKey: "sk-new",
      })
    ).rejects.toThrow("无权管理该资料库")
  })

  it("does not requeue sources when only the api key changes", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)

    const result = await service.updateEmbedding(OWNER_ID, library.id, {
      openAiApiKey: "sk-new",
    })

    expect(result.modelChanged).toBe(false)
    expect(result.hasApiKey).toBe(true)
    expect(repo.markAllSourcesQueuedCalls).toBe(0)
  })

  it("requeues sources once when the embedding model changes", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)

    const result = await service.updateEmbedding(OWNER_ID, library.id, {
      openAiEmbeddingModel: "text-embedding-3-large",
    })

    expect(result.modelChanged).toBe(true)
    expect(result.openAiEmbeddingModel).toBe("text-embedding-3-large")
    expect(repo.markAllSourcesQueuedCalls).toBe(1)
  })

  it("rejects removing the sole owner", async () => {
    const { service } = makeService()
    const library = await createOwnedLibrary(service)

    await expect(
      service.removeMember(OWNER_ID, library.id, OWNER_ID)
    ).rejects.toBeInstanceOf(ConflictException)
    await expect(
      service.removeMember(OWNER_ID, library.id, OWNER_ID)
    ).rejects.toThrow("资料库至少保留一名所有者")
  })

  it("rejects assigning the owner role when inviting", async () => {
    const { service } = makeService()
    const library = await createOwnedLibrary(service)

    await expect(
      service.inviteMember(OWNER_ID, library.id, {
        userId: MEMBER_ID,
        role: "owner" as Exclude<LibraryRole, "owner">,
      })
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.inviteMember(OWNER_ID, library.id, {
        userId: MEMBER_ID,
        role: "owner" as Exclude<LibraryRole, "owner">,
      })
    ).rejects.toThrow("不能指定所有者角色")
  })

  it("hides libraries from non-members and forbids their rename", async () => {
    const { service } = makeService()
    const library = await createOwnedLibrary(service)

    const listed = await service.list(OUTSIDER_ID)
    expect(listed.map((row) => row.id)).not.toContain(library.id)

    await expect(
      service.rename(OUTSIDER_ID, library.id, "偷改")
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      service.rename(OUTSIDER_ID, library.id, "偷改")
    ).rejects.toThrow("无权访问该资料库")
  })

  it("returns 404 when the library is missing", async () => {
    const { service } = makeService()

    await expect(
      service.rename(OWNER_ID, "missing-lib", "新名称")
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      service.rename(OWNER_ID, "missing-lib", "新名称")
    ).rejects.toThrow("资料库不存在")
  })

  it("resolves an invite by userId or email like workspace members", async () => {
    const { service, repo, users } = makeService()
    const library = await createOwnedLibrary(service)
    users.add({ id: "email-user", email: "invitee@example.com" })

    await expect(
      service.inviteMember(OWNER_ID, library.id, { role: "editor" })
    ).rejects.toThrow("请提供用户或邮箱")

    await service.inviteMember(OWNER_ID, library.id, {
      userId: MEMBER_ID,
      role: "editor",
    })
    expect(repo.libraries.get(library.id)?.members.get(MEMBER_ID)).toBe(
      "editor"
    )

    await service.inviteMember(OWNER_ID, library.id, {
      email: "  Invitee@Example.com  ",
      role: "viewer",
    })
    expect(repo.libraries.get(library.id)?.members.get("email-user")).toBe(
      "viewer"
    )
  })

  it("lets admin invite but not touch an owner row", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)
    repo.seedMember(library.id, ADMIN_ID, "admin")

    await service.inviteMember(ADMIN_ID, library.id, {
      userId: MEMBER_ID,
      role: "editor",
    })
    expect(repo.libraries.get(library.id)?.members.get(MEMBER_ID)).toBe(
      "editor"
    )

    await expect(
      service.updateMemberRole(ADMIN_ID, library.id, OWNER_ID, "admin")
    ).rejects.toThrow("无权管理该资料库")
  })

  it("lets a viewer list the library", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)
    repo.seedMember(library.id, VIEWER_ID, "viewer")

    const listed = await service.list(VIEWER_ID)
    expect(listed).toEqual([
      expect.objectContaining({
        id: library.id,
        role: "viewer",
        memberCount: 2,
      }),
    ])
  })

  it("lets only the owner read storage keys or delete the library", async () => {
    const { service, repo } = makeService()
    const library = await createOwnedLibrary(service)
    repo.seedMember(library.id, ADMIN_ID, "admin")
    const stored = repo.libraries.get(library.id)
    if (stored) {
      stored.storageKeys = ["files/a.pdf"]
    }

    await expect(service.fileStorageKeys(ADMIN_ID, library.id)).rejects.toThrow(
      "无权管理该资料库"
    )
    expect(await service.fileStorageKeys(OWNER_ID, library.id)).toEqual([
      "files/a.pdf",
    ])

    await expect(service.deleteLibrary(ADMIN_ID, library.id)).rejects.toThrow(
      "无权管理该资料库"
    )
    await service.deleteLibrary(OWNER_ID, library.id)
    expect(repo.libraries.has(library.id)).toBe(false)
  })
})

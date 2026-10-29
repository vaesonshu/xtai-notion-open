import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type { Prisma } from "../generated/prisma/client"
import { PrismaService } from "../database/prisma.module"
import { type EmbeddingSettings, type LibraryRole } from "./knowledge.types"

export type LibraryListRow = {
  id: string
  name: string
  role: LibraryRole
  sourceCount: number
  memberCount: number
  updatedAt: Date
}

export type LibraryMembership = {
  role: LibraryRole
  name: string
  embeddingSettings: EmbeddingSettings
  embeddingRevision: number
}

/** Service 只依赖这组方法，测试用内存实现替换，不把 Prisma 传进 service。 */
export type KnowledgeLibraryStore = {
  insertLibrary(
    userId: string,
    name: string
  ): Promise<{ id: string; name: string; updatedAt: Date }>
  listForUser(userId: string): Promise<LibraryListRow[]>
  requireMembership(
    libraryId: string,
    userId: string
  ): Promise<LibraryMembership>
  rename(libraryId: string, name: string): Promise<void>
  deleteLibrary(libraryId: string): Promise<void>
  saveEmbedding(
    libraryId: string,
    settings: EmbeddingSettings,
    revision: number
  ): Promise<void>
  markAllSourcesQueued(libraryId: string): Promise<void>
  listFileStorageKeys(libraryId: string): Promise<string[]>
  upsertMember(
    libraryId: string,
    userId: string,
    role: Exclude<LibraryRole, "owner">
  ): Promise<void>
  getMemberRole(libraryId: string, userId: string): Promise<LibraryRole | null>
  countOwners(libraryId: string): Promise<number>
  removeMember(libraryId: string, userId: string): Promise<void>
}

const LIBRARY_ROLES = new Set<LibraryRole>([
  "owner",
  "admin",
  "editor",
  "viewer",
])

function asLibraryRole(role: string): LibraryRole {
  return LIBRARY_ROLES.has(role as LibraryRole)
    ? (role as LibraryRole)
    : "viewer"
}

function asEmbeddingSettings(value: unknown): EmbeddingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  const raw = value as Record<string, unknown>
  const settings: EmbeddingSettings = {}
  if (typeof raw.openAiApiKey === "string") {
    settings.openAiApiKey = raw.openAiApiKey
  }
  if (typeof raw.openAiBaseUrl === "string") {
    settings.openAiBaseUrl = raw.openAiBaseUrl
  }
  if (typeof raw.openAiEmbeddingModel === "string") {
    settings.openAiEmbeddingModel = raw.openAiEmbeddingModel
  }
  return settings
}

@Injectable()
export class KnowledgeLibraryRepository implements KnowledgeLibraryStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async insertLibrary(
    userId: string,
    name: string
  ): Promise<{ id: string; name: string; updatedAt: Date }> {
    return this.prisma.client.$transaction(async (tx) => {
      const library = await tx.knowledgeLibrary.create({
        data: {
          name,
          createdBy: userId,
          updatedAt: new Date(),
          members: {
            create: { userId, role: "owner" },
          },
        },
      })
      return {
        id: library.id,
        name: library.name,
        updatedAt: library.updatedAt,
      }
    })
  }

  async listForUser(userId: string): Promise<LibraryListRow[]> {
    const memberships =
      await this.prisma.client.knowledgeLibraryMember.findMany({
        where: { userId },
        include: {
          library: {
            include: {
              _count: { select: { members: true, sources: true } },
            },
          },
        },
        orderBy: { library: { updatedAt: "desc" } },
      })

    return memberships.map((membership) => ({
      id: membership.library.id,
      name: membership.library.name,
      role: asLibraryRole(membership.role),
      sourceCount: membership.library._count.sources,
      memberCount: membership.library._count.members,
      updatedAt: membership.library.updatedAt,
    }))
  }

  async requireMembership(
    libraryId: string,
    userId: string
  ): Promise<LibraryMembership> {
    // 先确认库存在，再判断成员，避免把「没有这个库」说成「没权限」。
    const library = await this.prisma.client.knowledgeLibrary.findUnique({
      where: { id: libraryId },
      include: { members: { where: { userId } } },
    })
    if (!library) {
      throw new NotFoundException("资料库不存在")
    }
    const member = library.members[0]
    if (!member) {
      throw new ForbiddenException("无权访问该资料库")
    }
    return {
      role: asLibraryRole(member.role),
      name: library.name,
      embeddingSettings: asEmbeddingSettings(library.embeddingSettings),
      embeddingRevision: library.embeddingRevision,
    }
  }

  async rename(libraryId: string, name: string): Promise<void> {
    await this.prisma.client.knowledgeLibrary.update({
      where: { id: libraryId },
      data: { name, updatedAt: new Date() },
    })
  }

  async deleteLibrary(libraryId: string): Promise<void> {
    // 只删数据库行；对象存储清理由调用方拿 listFileStorageKeys 另做。
    await this.prisma.client.knowledgeLibrary.delete({
      where: { id: libraryId },
    })
  }

  async saveEmbedding(
    libraryId: string,
    settings: EmbeddingSettings,
    revision: number
  ): Promise<void> {
    await this.prisma.client.knowledgeLibrary.update({
      where: { id: libraryId },
      data: {
        embeddingSettings: settings as Prisma.InputJsonValue,
        embeddingRevision: revision,
        updatedAt: new Date(),
      },
    })
  }

  async markAllSourcesQueued(libraryId: string): Promise<void> {
    await this.prisma.client.knowledgeSource.updateMany({
      where: { libraryId },
      data: { status: "queued", updatedAt: new Date() },
    })
  }

  async listFileStorageKeys(libraryId: string): Promise<string[]> {
    const rows = await this.prisma.client.knowledgeSource.findMany({
      where: { libraryId, storageKey: { not: null } },
      select: { storageKey: true },
    })
    return rows.flatMap((row) => (row.storageKey ? [row.storageKey] : []))
  }

  async upsertMember(
    libraryId: string,
    userId: string,
    role: Exclude<LibraryRole, "owner">
  ): Promise<void> {
    await this.prisma.client.knowledgeLibraryMember.upsert({
      where: { libraryId_userId: { libraryId, userId } },
      create: { libraryId, userId, role },
      update: { role },
    })
  }

  async getMemberRole(
    libraryId: string,
    userId: string
  ): Promise<LibraryRole | null> {
    const member = await this.prisma.client.knowledgeLibraryMember.findUnique({
      where: { libraryId_userId: { libraryId, userId } },
      select: { role: true },
    })
    return member ? asLibraryRole(member.role) : null
  }

  async countOwners(libraryId: string): Promise<number> {
    return this.prisma.client.knowledgeLibraryMember.count({
      where: { libraryId, role: "owner" },
    })
  }

  async removeMember(libraryId: string, userId: string): Promise<void> {
    await this.prisma.client.knowledgeLibraryMember.deleteMany({
      where: { libraryId, userId },
    })
  }
}

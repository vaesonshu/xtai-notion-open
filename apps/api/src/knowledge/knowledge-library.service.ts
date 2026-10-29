import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { UserRepository } from "../auth/user.repository"
import {
  KnowledgeLibraryRepository,
  type KnowledgeLibraryStore,
} from "./knowledge-library.repository"
import {
  applyEmbeddingPatch,
  DEFAULT_EMBEDDING_BASE_URL,
  type EmbeddingSettings,
  type LibraryRole,
  roleAtLeast,
} from "./knowledge.types"

export type LibrarySummary = {
  id: string
  name: string
  role: LibraryRole
  sourceCount: number
  memberCount: number
  updatedAt: string
}

type InviteMemberInput = {
  userId?: string
  email?: string
  role: Exclude<LibraryRole, "owner">
}

type EmbeddingPublicView = {
  openAiBaseUrl: string
  openAiEmbeddingModel: string
  hasApiKey: boolean
  modelChanged: boolean
}

@Injectable()
export class KnowledgeLibraryService {
  constructor(
    @Inject(KnowledgeLibraryRepository)
    private readonly libraries: KnowledgeLibraryStore,
    @Inject(UserRepository)
    private readonly users: Pick<UserRepository, "findById" | "findByEmail">
  ) {}

  async create(userId: string, name: string): Promise<LibrarySummary> {
    const trimmed = this.assertLibraryName(name)
    const row = await this.libraries.insertLibrary(userId, trimmed)
    return {
      id: row.id,
      name: row.name,
      role: "owner",
      sourceCount: 0,
      memberCount: 1,
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  async list(userId: string): Promise<LibrarySummary[]> {
    const rows = await this.libraries.listForUser(userId)
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      sourceCount: row.sourceCount,
      memberCount: row.memberCount,
      updatedAt: row.updatedAt.toISOString(),
    }))
  }

  async rename(userId: string, libraryId: string, name: string): Promise<void> {
    const trimmed = this.assertLibraryName(name)
    await this.requireOwner(userId, libraryId)
    await this.libraries.rename(libraryId, trimmed)
  }

  async fileStorageKeys(userId: string, libraryId: string): Promise<string[]> {
    await this.requireOwner(userId, libraryId)
    return this.libraries.listFileStorageKeys(libraryId)
  }

  async deleteLibrary(userId: string, libraryId: string): Promise<void> {
    await this.requireOwner(userId, libraryId)
    await this.libraries.deleteLibrary(libraryId)
  }

  async updateEmbedding(
    userId: string,
    libraryId: string,
    patch: EmbeddingSettings
  ): Promise<EmbeddingPublicView> {
    const membership = await this.requireOwner(userId, libraryId)
    const patched = applyEmbeddingPatch(
      {
        settings: membership.embeddingSettings,
        revision: membership.embeddingRevision,
      },
      patch
    )
    await this.libraries.saveEmbedding(
      libraryId,
      patched.settings,
      patched.revision
    )
    // 只改 Key 不算模型变化，避免无意义地把全部来源打回排队。
    if (patched.modelChanged) {
      await this.libraries.markAllSourcesQueued(libraryId)
    }
    return {
      openAiBaseUrl:
        patched.settings.openAiBaseUrl ?? DEFAULT_EMBEDDING_BASE_URL,
      openAiEmbeddingModel: patched.settings.openAiEmbeddingModel ?? "",
      hasApiKey: Boolean(patched.settings.openAiApiKey),
      modelChanged: patched.modelChanged,
    }
  }

  async inviteMember(
    actorId: string,
    libraryId: string,
    input: InviteMemberInput
  ): Promise<void> {
    await this.requireAdmin(actorId, libraryId)
    this.assertAssignableRole(input.role)
    const userId = await this.resolveInvitee(input)
    await this.assertNotOwnerRow(libraryId, userId)
    await this.libraries.upsertMember(libraryId, userId, input.role)
  }

  async updateMemberRole(
    actorId: string,
    libraryId: string,
    memberUserId: string,
    role: Exclude<LibraryRole, "owner">
  ): Promise<void> {
    await this.requireAdmin(actorId, libraryId)
    this.assertAssignableRole(role)
    const targetRole = await this.requireExistingMember(libraryId, memberUserId)
    if (targetRole === "owner") {
      throw new ForbiddenException("无权管理该资料库")
    }
    await this.libraries.upsertMember(libraryId, memberUserId, role)
  }

  async removeMember(
    actorId: string,
    libraryId: string,
    memberUserId: string
  ): Promise<void> {
    await this.requireAdmin(actorId, libraryId)
    const targetRole = await this.requireExistingMember(libraryId, memberUserId)
    if (targetRole === "owner") {
      const ownerCount = await this.libraries.countOwners(libraryId)
      if (ownerCount <= 1) {
        throw new ConflictException("资料库至少保留一名所有者")
      }
      const actor = await this.libraries.requireMembership(libraryId, actorId)
      if (actor.role !== "owner") {
        throw new ForbiddenException("无权管理该资料库")
      }
    }
    await this.libraries.removeMember(libraryId, memberUserId)
  }

  /**
   * editor 不足用「查看者无法修改资料库」；更高门槛沿用 Task 6 管理文案。
   * 库不存在 / 非成员仍走 requireMembership 的 404 / 403。
   */
  async requireRole(userId: string, libraryId: string, minimum: LibraryRole) {
    const membership = await this.libraries.requireMembership(libraryId, userId)
    if (!roleAtLeast(membership.role, minimum)) {
      throw new ForbiddenException(
        minimum === "editor" ? "查看者无法修改资料库" : "无权管理该资料库"
      )
    }
    return membership
  }

  private assertLibraryName(name: string): string {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new BadRequestException("资料库名称不能为空")
    }
    if (trimmed.length > 80) {
      throw new BadRequestException("资料库名称不能超过 80 字")
    }
    return trimmed
  }

  private assertAssignableRole(role: string): void {
    if (role === "owner") {
      throw new BadRequestException("不能指定所有者角色")
    }
  }

  private async requireOwner(userId: string, libraryId: string) {
    return this.requireRole(userId, libraryId, "owner")
  }

  private async requireAdmin(userId: string, libraryId: string) {
    return this.requireRole(userId, libraryId, "admin")
  }

  private async requireExistingMember(
    libraryId: string,
    memberUserId: string
  ): Promise<LibraryRole> {
    const role = await this.libraries.getMemberRole(libraryId, memberUserId)
    if (!role) {
      throw new NotFoundException("成员不存在")
    }
    return role
  }

  private async assertNotOwnerRow(
    libraryId: string,
    userId: string
  ): Promise<void> {
    const existing = await this.libraries.getMemberRole(libraryId, userId)
    if (existing === "owner") {
      throw new ForbiddenException("无权管理该资料库")
    }
  }

  /** 与工作区邀请相同：有 userId 查 id，否则用规范化邮箱。 */
  private async resolveInvitee(input: InviteMemberInput): Promise<string> {
    const userId = input.userId?.trim()
    const email = input.email?.trim()
    if (userId) {
      const user = await this.users.findById(userId)
      if (!user) {
        throw new NotFoundException("用户不存在")
      }
      return user.id
    }
    if (email) {
      const user = await this.users.findByEmail(email.toLowerCase())
      if (!user) {
        throw new NotFoundException("未找到该邮箱对应的用户")
      }
      return user.id
    }
    throw new BadRequestException("请提供用户或邮箱")
  }
}

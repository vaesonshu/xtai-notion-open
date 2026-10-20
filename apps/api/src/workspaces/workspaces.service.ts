import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { UserRepository } from "../auth/user.repository"
import { WorkspaceRepository } from "./workspace.repository"
import {
  mergeWorkspaceAiSettings,
  parseWorkspaceAiSettings,
  type WorkspaceAiSettings,
} from "./workspace-ai.types"
import {
  isWorkspaceRole,
  isWorkspaceVisibility,
  type PublicWorkspaceView,
  type WorkspaceInviteCandidate,
  type WorkspaceMemberView,
  type WorkspaceRole,
  type WorkspaceSummary,
  type WorkspaceVisibility,
} from "./workspace.types"
import {
  isUuid,
  isWorkspaceSlug,
  slugifyWorkspaceName,
} from "./workspace-slug.util"

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(WorkspaceRepository)
    private readonly workspaces: WorkspaceRepository,
    @Inject(UserRepository) private readonly users: UserRepository
  ) {}

  private toSummary(
    row: {
      id: string
      name: string
      slug: string | null
      visibility: WorkspaceVisibility
      settings?: unknown
      createdAt: Date
      updatedAt: Date
      role: WorkspaceRole
      memberCount: number
      documentCount: number
    }
  ): WorkspaceSummary {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      visibility: row.visibility,
      memberCount: row.memberCount,
      documentCount: row.documentCount,
      role: row.role,
      aiSettings: parseWorkspaceAiSettings(row.settings),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  private assertCanManage(role: WorkspaceRole | null): WorkspaceRole {
    if (!role || (role !== "owner" && role !== "admin")) {
      throw new ForbiddenException("无权管理该知识库")
    }
    return role
  }

  async listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const rows = await this.workspaces.listForUser(userId)
    return rows.map((row) => this.toSummary(row))
  }

  async getWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceSummary> {
    const role = await this.workspaces.getMemberRole(workspaceId, userId)
    if (!role) {
      throw new ForbiddenException("不是该知识库成员")
    }
    const workspace = await this.workspaces.findById(workspaceId)
    if (!workspace) {
      throw new NotFoundException("知识库不存在")
    }
    const [memberCount, documentCount] = await Promise.all([
      this.workspaces.countMembers(workspaceId),
      this.workspaces.countActiveDocuments(workspaceId),
    ])
    return this.toSummary({ ...workspace, role, memberCount, documentCount })
  }

  async createWorkspace(
    userId: string,
    name: string
  ): Promise<WorkspaceSummary> {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new ConflictException("知识库名称不能为空")
    }
    const slug = await this.workspaces.allocateUniqueSlug(
      slugifyWorkspaceName(trimmed)
    )
    const row = await this.workspaces.create(trimmed, userId, slug)
    return this.toSummary({
      ...row,
      role: "owner",
      memberCount: 1,
      documentCount: 0,
    })
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    patch: {
      name?: string
      visibility?: WorkspaceVisibility
      slug?: string | null
    }
  ): Promise<WorkspaceSummary> {
    await this.assertCanManage(
      await this.workspaces.getMemberRole(workspaceId, userId)
    )
    let row = await this.workspaces.findById(workspaceId)
    if (!row) {
      throw new NotFoundException("知识库不存在")
    }

    if (patch.name !== undefined) {
      const trimmed = patch.name.trim()
      if (!trimmed) {
        throw new ConflictException("知识库名称不能为空")
      }
      row =
        (await this.workspaces.rename(workspaceId, trimmed)) ?? row
    }

    if (patch.visibility !== undefined) {
      if (!isWorkspaceVisibility(patch.visibility)) {
        throw new ConflictException("无效的知识库可见性")
      }
      row =
        (await this.workspaces.updateVisibility(
          workspaceId,
          patch.visibility
        )) ?? row
    }

    if (patch.slug !== undefined) {
      const normalized =
        patch.slug === null || patch.slug.trim() === ""
          ? null
          : patch.slug.trim().toLowerCase()
      if (normalized !== null && !isWorkspaceSlug(normalized)) {
        throw new ConflictException(
          "短链仅支持小写字母、数字与连字符（2–48 字符）"
        )
      }
      if (
        normalized !== null &&
        (await this.workspaces.isSlugTaken(normalized, workspaceId))
      ) {
        throw new ConflictException("该短链已被占用")
      }
      row = (await this.workspaces.updateSlug(workspaceId, normalized)) ?? row
    }

    const role = await this.workspaces.getMemberRole(workspaceId, userId)
    const [memberCount, documentCount] = await Promise.all([
      this.workspaces.countMembers(workspaceId),
      this.workspaces.countActiveDocuments(workspaceId),
    ])
    return this.toSummary({
      ...row,
      role: role ?? "viewer",
      memberCount,
      documentCount,
    })
  }

  async resolveWorkspaceId(key: string): Promise<string | null> {
    const trimmed = key.trim()
    if (!trimmed) return null
    if (isUuid(trimmed)) {
      const row = await this.workspaces.findById(trimmed)
      return row?.id ?? null
    }
    const bySlug = await this.workspaces.findBySlug(trimmed.toLowerCase())
    return bySlug?.id ?? null
  }

  /** 对外公开页：非 public 库统一 404，避免泄露私有库存在。 */
  async getPublicWorkspace(key: string): Promise<PublicWorkspaceView> {
    const workspaceId = await this.resolveWorkspaceId(key)
    if (!workspaceId) {
      throw new NotFoundException("知识库不存在或未公开")
    }
    const row = await this.workspaces.findById(workspaceId)
    if (!row || row.visibility !== "public") {
      throw new NotFoundException("知识库不存在或未公开")
    }
    const publishedDocumentCount =
      await this.workspaces.countPublishedDocuments(workspaceId)
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      visibility: "public",
      publishedDocumentCount,
    }
  }

  async listMembers(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceMemberView[]> {
    const role = await this.workspaces.getMemberRole(workspaceId, userId)
    if (!role) {
      throw new ForbiddenException("不是该知识库成员")
    }
    const members = await this.workspaces.listMembers(workspaceId)
    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      color: member.user.color,
      role: isWorkspaceRole(member.role)
        ? (member.role as WorkspaceRole)
        : "viewer",
    }))
  }

  async searchInviteCandidates(
    workspaceId: string,
    actorId: string,
    query: string
  ): Promise<WorkspaceInviteCandidate[]> {
    await this.assertCanManage(
      await this.workspaces.getMemberRole(workspaceId, actorId)
    )
    const members = await this.workspaces.listMembers(workspaceId)
    const excludeUserIds = members.map((member) => member.userId)
    const rows = await this.users.searchForWorkspaceInvite(
      query,
      excludeUserIds
    )
    return rows.map((row) => ({
      userId: row.id,
      email: row.email,
      displayName: row.display_name,
      color: row.color,
    }))
  }

  async addMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    role: WorkspaceRole
  ): Promise<void> {
    await this.assertCanManage(
      await this.workspaces.getMemberRole(workspaceId, actorId)
    )
    if (!isWorkspaceRole(role) || role === "owner") {
      throw new ConflictException("无效的成员角色")
    }
    const user = await this.users.findById(targetUserId)
    if (!user) {
      throw new NotFoundException("用户不存在")
    }
    await this.workspaces.addMember(workspaceId, targetUserId, role)
  }

  async inviteMemberByEmail(
    workspaceId: string,
    actorId: string,
    email: string,
    role: WorkspaceRole
  ): Promise<void> {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      throw new ConflictException("邮箱不能为空")
    }
    const user = await this.users.findByEmail(normalized)
    if (!user) {
      throw new NotFoundException("未找到该邮箱对应的用户")
    }
    await this.addMember(workspaceId, actorId, user.id, role)
  }

  async updateMemberRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    role: WorkspaceRole
  ): Promise<void> {
    await this.assertCanManage(
      await this.workspaces.getMemberRole(workspaceId, actorId)
    )
    if (!isWorkspaceRole(role) || role === "owner") {
      throw new ConflictException("无效的成员角色")
    }

    const targetRole = await this.workspaces.getMemberRole(
      workspaceId,
      targetUserId
    )
    if (!targetRole) {
      throw new NotFoundException("成员不存在")
    }
    if (targetRole === "owner") {
      throw new ForbiddenException("无法修改所有者的角色")
    }

    await this.workspaces.addMember(workspaceId, targetUserId, role)
  }

  async removeMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string
  ): Promise<void> {
    await this.assertCanManage(
      await this.workspaces.getMemberRole(workspaceId, actorId)
    )
    const targetRole = await this.workspaces.getMemberRole(
      workspaceId,
      targetUserId
    )
    if (!targetRole) {
      throw new NotFoundException("成员不存在")
    }
    if (targetRole === "owner") {
      const ownerCount = await this.workspaces.countOwners(workspaceId)
      if (ownerCount <= 1) {
        throw new ConflictException("知识库至少保留一名所有者")
      }
    }
    await this.workspaces.removeMember(workspaceId, targetUserId)
  }

  async assertWorkspaceMember(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceRole> {
    const role = await this.workspaces.getMemberRole(workspaceId, userId)
    if (!role) {
      throw new ForbiddenException("不是该知识库成员")
    }
    return role
  }

  async getMemberRole(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceRole | null> {
    return this.workspaces.getMemberRole(workspaceId, userId)
  }

  async getAiSettings(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceAiSettings> {
    const role = await this.workspaces.getMemberRole(workspaceId, userId)
    if (!role) {
      throw new ForbiddenException("不是该知识库成员")
    }
    const workspace = await this.workspaces.findById(workspaceId)
    if (!workspace) {
      throw new NotFoundException("知识库不存在")
    }
    return parseWorkspaceAiSettings(workspace.settings)
  }

  async updateAiSettings(
    workspaceId: string,
    userId: string,
    patch: Partial<WorkspaceAiSettings>
  ): Promise<WorkspaceAiSettings> {
    await this.assertCanManage(
      await this.workspaces.getMemberRole(workspaceId, userId)
    )
    const workspace = await this.workspaces.findById(workspaceId)
    if (!workspace) {
      throw new NotFoundException("知识库不存在")
    }
    const next = mergeWorkspaceAiSettings(workspace.settings, patch)
    const updated = await this.workspaces.updateSettings(workspaceId, next)
    if (!updated) {
      throw new NotFoundException("知识库不存在")
    }
    return parseWorkspaceAiSettings(updated.settings)
  }
}

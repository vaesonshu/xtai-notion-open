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
  isWorkspaceRole,
  type WorkspaceInviteCandidate,
  type WorkspaceMemberView,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "./workspace.types"

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
      memberCount: row.memberCount,
      documentCount: row.documentCount,
      role: row.role,
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
    const row = await this.workspaces.create(trimmed, userId)
    return this.toSummary({
      ...row,
      role: "owner",
      memberCount: 1,
      documentCount: 0,
    })
  }

  async renameWorkspace(
    workspaceId: string,
    userId: string,
    name: string
  ): Promise<WorkspaceSummary> {
    await this.assertCanManage(
      await this.workspaces.getMemberRole(workspaceId, userId)
    )
    const trimmed = name.trim()
    if (!trimmed) {
      throw new ConflictException("知识库名称不能为空")
    }
    const row = await this.workspaces.rename(workspaceId, trimmed)
    if (!row) {
      throw new NotFoundException("知识库不存在")
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
}

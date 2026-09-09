import { Inject, Injectable } from "@nestjs/common"
import type { Workspace } from "../generated/prisma/client"
import { PrismaService } from "../database/prisma.module"
import {
  isWorkspaceRole,
  type WorkspaceListRow,
  type WorkspaceRole,
  type WorkspaceRow,
} from "./workspace.types"

@Injectable()
export class WorkspaceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private toRow(workspace: Workspace): WorkspaceRow {
    return {
      id: workspace.id,
      name: workspace.name,
      createdBy: workspace.createdBy,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    }
  }

  async create(name: string, createdBy: string): Promise<WorkspaceRow> {
    return this.prisma.client.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name,
          createdBy,
          updatedAt: new Date(),
        },
      })
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: createdBy,
          role: "owner",
        },
      })
      return this.toRow(workspace)
    })
  }

  async findById(workspaceId: string): Promise<WorkspaceRow | null> {
    const workspace = await this.prisma.client.workspace.findUnique({
      where: { id: workspaceId },
    })
    return workspace ? this.toRow(workspace) : null
  }

  async rename(workspaceId: string, name: string): Promise<WorkspaceRow | null> {
    const workspace = await this.prisma.client.workspace.update({
      where: { id: workspaceId },
      data: { name, updatedAt: new Date() },
    })
    return this.toRow(workspace)
  }

  async getMemberRole(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceRole | null> {
    const member = await this.prisma.client.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      select: { role: true },
    })
    return isWorkspaceRole(member?.role)
      ? (member.role as WorkspaceRole)
      : null
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<void> {
    await this.prisma.client.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      create: { workspaceId, userId, role },
      update: { role },
    })
  }

  /**
   * 分享链接接受：至少授予 editor；viewer 升级，owner/admin/editor 不降级。
   */
  async upsertMemberAsEditorForShareLink(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceRole> {
    return this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId },
        },
        select: { role: true },
      })
      if (!existing) {
        await tx.workspaceMember.create({
          data: { workspaceId, userId, role: "editor" },
        })
        return "editor"
      }
      const current = isWorkspaceRole(existing.role) ? existing.role : "viewer"
      if (current === "viewer") {
        await tx.workspaceMember.update({
          where: {
            workspaceId_userId: { workspaceId, userId },
          },
          data: { role: "editor" },
        })
        return "editor"
      }
      return current
    })
  }

  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.client.workspaceMember.deleteMany({
      where: { workspaceId, userId },
    })
    return result.count > 0
  }

  async countMembers(workspaceId: string): Promise<number> {
    return this.prisma.client.workspaceMember.count({
      where: { workspaceId },
    })
  }

  async countOwners(workspaceId: string): Promise<number> {
    return this.prisma.client.workspaceMember.count({
      where: { workspaceId, role: "owner" },
    })
  }

  async listMembers(workspaceId: string) {
    return this.prisma.client.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, email: true, displayName: true, color: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  }

  async listForUser(userId: string): Promise<WorkspaceListRow[]> {
    const memberships = await this.prisma.client.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                documents: { where: { deletedAt: null } },
              },
            },
          },
        },
      },
      orderBy: { workspace: { updatedAt: "desc" } },
    })

    return memberships.map((membership) => ({
      ...this.toRow(membership.workspace),
      role: isWorkspaceRole(membership.role)
        ? (membership.role as WorkspaceRole)
        : "viewer",
      memberCount: membership.workspace._count.members,
      documentCount: membership.workspace._count.documents,
    }))
  }

  async countActiveDocuments(workspaceId: string): Promise<number> {
    return this.prisma.client.document.count({
      where: { workspaceId, deletedAt: null },
    })
  }

  /** 用户最近更新的 owner 知识库，供默认建文档时使用。 */
  async findDefaultForUser(userId: string): Promise<WorkspaceRow | null> {
    const membership = await this.prisma.client.workspaceMember.findFirst({
      where: { userId, role: "owner" },
      include: { workspace: true },
      orderBy: { workspace: { updatedAt: "desc" } },
    })
    return membership ? this.toRow(membership.workspace) : null
  }
}

import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import type { DocumentShareLink } from "../generated/prisma/client"
import { PrismaService } from "../database/prisma.module"
import { WorkspaceRepository } from "../workspaces/workspace.repository"
import { mapWorkspaceRoleToDocumentRole } from "../workspaces/workspace.types"
import type { ShareLinkRow } from "./share-link-types"

@Injectable()
export class ShareLinkRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkspaceRepository)
    private readonly workspaces: WorkspaceRepository
  ) {}

  // Prisma 返回 camelCase 模型，映射回调用方依赖的 snake_case 行形状。
  private toRow(link: DocumentShareLink): ShareLinkRow {
    return {
      token: link.token,
      document_id: link.documentId,
      created_by: link.createdBy,
      created_at: link.createdAt,
      revoked_at: link.revokedAt,
    }
  }

  async findActiveByDocumentId(
    documentId: string
  ): Promise<ShareLinkRow | null> {
    const link = await this.prisma.client.documentShareLink.findFirst({
      where: { documentId, revokedAt: null },
    })
    return link ? this.toRow(link) : null
  }

  async findActiveByToken(token: string): Promise<ShareLinkRow | null> {
    const link = await this.prisma.client.documentShareLink.findFirst({
      where: { token, revokedAt: null },
    })
    return link ? this.toRow(link) : null
  }

  async create(
    documentId: string,
    createdBy: string,
    token: string
  ): Promise<ShareLinkRow> {
    const link = await this.prisma.client.documentShareLink.create({
      data: { token, documentId, createdBy },
    })
    return this.toRow(link)
  }

  async upsertMemberAsEditor(
    documentId: string,
    userId: string
  ): Promise<"owner" | "editor"> {
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
      select: { workspaceId: true },
    })
    if (!document) {
      throw new NotFoundException("Document not found")
    }

    // P2：分享接受写入 workspace_member，不再创建 document_member。
    const workspaceRole =
      await this.workspaces.upsertMemberAsEditorForShareLink(
        document.workspaceId,
        userId
      )
    const role = mapWorkspaceRoleToDocumentRole(workspaceRole)
    if (role !== "owner" && role !== "editor") {
      throw new Error("Failed to update workspace membership")
    }
    return role
  }
}

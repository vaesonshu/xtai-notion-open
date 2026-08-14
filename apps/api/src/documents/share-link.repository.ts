import { Inject, Injectable } from "@nestjs/common"
import type { DocumentShareLink } from "../generated/prisma/client"
import { PrismaService } from "../database/prisma.module"
import type { ShareLinkRow } from "./share-link-types"

@Injectable()
export class ShareLinkRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    // 该 upsert 的 role 升级规则（viewer 升 editor、owner/editor 保持）无法用
    // Prisma 的通用 upsert 表达，保留原生 SQL 以保证“插入或按规则升级”原子。
    return this.prisma.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ role: string }>>`
        INSERT INTO document_member (document_id, user_id, role)
        VALUES (${documentId}, ${userId}, 'editor')
        ON CONFLICT (document_id, user_id) DO UPDATE
        SET role = CASE
          WHEN document_member.role = 'viewer' THEN 'editor'
          ELSE document_member.role
        END
        RETURNING role`
      const role = rows[0]?.role
      if (role !== "owner" && role !== "editor") {
        throw new Error("Failed to update document membership")
      }
      return role
    })
  }
}

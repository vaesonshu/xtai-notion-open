import { Inject, Injectable } from "@nestjs/common"
import type { Document } from "../generated/prisma/client"
import { PrismaService } from "../database/prisma.module"
import type {
  DocumentListRow,
  DocumentRole,
  DocumentRow,
  PublicationStatus,
  PublishedArticleSource,
} from "./document-types"
import { isDocumentRole } from "./document-types"

@Injectable()
export class DocumentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Prisma 以 camelCase 返回模型，映射回调用方依赖的 snake_case 行形状，
  // 让 service 层无需感知底层 ORM 的变化。
  private toDocumentRow(document: Document): DocumentRow {
    return {
      id: document.id,
      workspace_id: document.workspaceId,
      parent_id: document.parentId,
      depth: document.depth,
      title: document.title,
      created_at: document.createdAt,
      updated_at: document.updatedAt,
      publication_status: document.publicationStatus as PublicationStatus,
      schema_version: document.schemaVersion,
      rejection_reason: document.rejectionReason,
      published_at: document.publishedAt,
      published_by: document.publishedBy,
    }
  }

  async getMemberRole(
    documentId: string,
    userId: string
  ): Promise<DocumentRole | null> {
    const member = await this.prisma.client.documentMember.findFirst({
      where: { documentId, userId },
      select: { role: true },
    })
    return isDocumentRole(member?.role) ? (member.role as DocumentRole) : null
  }

  async findById(documentId: string): Promise<DocumentRow | null> {
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
    })
    return document ? this.toDocumentRow(document) : null
  }

  /** 读取 document 表的 schema_version（缺省视为 v1）。 */
  async getSchemaVersion(documentId: string): Promise<number> {
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
      select: { schemaVersion: true },
    })
    return document?.schemaVersion ?? 1
  }

  /** 迁移成功后持久化新的协作 schema 版本。 */
  async updateSchemaVersion(
    documentId: string,
    schemaVersion: number
  ): Promise<void> {
    await this.prisma.client.document.updateMany({
      where: { id: documentId },
      data: { schemaVersion, updatedAt: new Date() },
    })
  }

  async listForUser(userId: string): Promise<DocumentListRow[]> {
    const documents = await this.prisma.client.document.findMany({
      where: { members: { some: { userId } } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: { members: { where: { userId }, select: { role: true } } },
    })
    return documents.map((document) => ({
      ...this.toDocumentRow(document),
      role: isDocumentRole(document.members[0]?.role)
        ? (document.members[0]?.role as DocumentRole)
        : "viewer",
    }))
  }

  async rename(documentId: string, title: string): Promise<DocumentRow | null> {
    // updateMany 无 RETURNING；先更新再按影响行数决定是否回读，保持返回 null 语义。
    const result = await this.prisma.client.document.updateMany({
      where: { id: documentId },
      data: { title, updatedAt: new Date() },
    })
    if (result.count === 0) return null
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
    })
    return document ? this.toDocumentRow(document) : null
  }

  async remove(documentId: string): Promise<boolean> {
    const result = await this.prisma.client.document.deleteMany({
      where: { id: documentId },
    })
    return result.count > 0
  }

  async createForOwner(userId: string): Promise<DocumentRow> {
    return this.prisma.client.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: "个人空间" },
      })
      const document = await tx.document.create({
        data: {
          workspaceId: workspace.id,
          title: "未命名文档",
          depth: 1,
          ownerId: userId,
        },
      })
      await tx.documentMember.create({
        data: { documentId: document.id, userId, role: "owner" },
      })
      return this.toDocumentRow(document)
    })
  }

  async createChild(parent: DocumentRow, userId: string): Promise<DocumentRow> {
    return this.prisma.client.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          workspaceId: parent.workspace_id,
          parentId: parent.id,
          depth: (parent.depth ?? 1) + 1,
          title: "未命名文档",
          ownerId: userId,
        },
      })
      await tx.documentMember.create({
        data: { documentId: document.id, userId, role: "owner" },
      })
      return this.toDocumentRow(document)
    })
  }

  async submitPublication(documentId: string): Promise<DocumentRow | null> {
    // compare-and-set：仅 draft 可进入 pending。保留原生 SQL 使“条件更新 +
    // 返回新行”保持原子，避免先读后写的竞态。
    const rows = await this.prisma.client.$queryRaw<DocumentRow[]>`
      UPDATE document
      SET publication_status = 'pending', rejection_reason = NULL, updated_at = NOW()
      WHERE id = ${documentId} AND publication_status = 'draft'
      RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                publication_status, rejection_reason, published_at, published_by`
    return rows[0] ?? null
  }

  async approvePublication(
    documentId: string,
    adminUserId: string
  ): Promise<DocumentRow | null> {
    // compare-and-set 防止第二个管理员基于过期的 pending 状态重复审批。
    const rows = await this.prisma.client.$queryRaw<DocumentRow[]>`
      UPDATE document
      SET publication_status = 'published', published_at = NOW(),
          published_by = ${adminUserId}, rejection_reason = NULL, updated_at = NOW()
      WHERE id = ${documentId} AND publication_status = 'pending'
      RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                publication_status, rejection_reason, published_at, published_by`
    return rows[0] ?? null
  }

  async rejectPublication(
    documentId: string,
    reason: string
  ): Promise<DocumentRow | null> {
    // compare-and-set：只有 pending 的版本能被退回为可写 draft。
    const rows = await this.prisma.client.$queryRaw<DocumentRow[]>`
      UPDATE document
      SET publication_status = 'draft', rejection_reason = ${reason}, updated_at = NOW()
      WHERE id = ${documentId} AND publication_status = 'pending'
      RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                publication_status, rejection_reason, published_at, published_by`
    return rows[0] ?? null
  }

  async listPendingPublications(): Promise<DocumentRow[]> {
    const documents = await this.prisma.client.document.findMany({
      where: { publicationStatus: "pending" },
      orderBy: { updatedAt: "asc" },
    })
    return documents.map((document) => this.toDocumentRow(document))
  }

  async listPublishedArticles(): Promise<PublishedArticleSource[]> {
    const documents = await this.prisma.client.document.findMany({
      where: { publicationStatus: "published" },
      orderBy: { publishedAt: "desc" },
      include: {
        owner: { select: { displayName: true, color: true } },
        workspace: { select: { name: true } },
      },
    })
    return documents.map((document) => ({
      row: this.toDocumentRow(document),
      authorName: document.owner?.displayName ?? null,
      authorColor: document.owner?.color ?? null,
      workspaceName: document.workspace.name,
    }))
  }

  async findPublishedById(
    documentId: string
  ): Promise<PublishedArticleSource | null> {
    const document = await this.prisma.client.document.findFirst({
      where: { id: documentId, publicationStatus: "published" },
      include: {
        owner: { select: { displayName: true, color: true } },
        workspace: { select: { name: true } },
      },
    })
    if (!document) return null
    return {
      row: this.toDocumentRow(document),
      authorName: document.owner?.displayName ?? null,
      authorColor: document.owner?.color ?? null,
      workspaceName: document.workspace.name,
    }
  }
}
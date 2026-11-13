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
      deleted_at: document.deletedAt,
    }
  }

  async countMembers(documentId: string): Promise<number> {
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
      select: { workspaceId: true },
    })
    if (!document) return 0
    return this.prisma.client.workspaceMember.count({
      where: { workspaceId: document.workspaceId },
    })
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

  async findOwnerId(documentId: string): Promise<string | null> {
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
      select: { ownerId: true },
    })
    return document?.ownerId ?? null
  }

  async findById(documentId: string): Promise<DocumentRow | null> {
    const document = await this.prisma.client.document.findFirst({
      where: { id: documentId, deletedAt: null },
    })
    return document ? this.toDocumentRow(document) : null
  }

  /** 回收站列表：仅返回当前用户可访问且已软删除的文档 */
  async findTrashedById(documentId: string): Promise<DocumentRow | null> {
    const document = await this.prisma.client.document.findFirst({
      where: { id: documentId, deletedAt: { not: null } },
    })
    return document ? this.toDocumentRow(document) : null
  }

  /** 读取 document 表的 schema_version（缺省视为当前块 schema）。 */
  async getSchemaVersion(documentId: string): Promise<number> {
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
      select: { schemaVersion: true },
    })
    return document?.schemaVersion ?? 2
  }

  /** 持久化协作 schema 版本号。 */
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
      where: {
        deletedAt: null,
        workspace: { members: { some: { userId } } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        workspace: {
          include: {
            members: { where: { userId }, select: { role: true } },
          },
        },
        userPrefs: {
          where: { userId },
          select: { isFavorite: true, lastOpenedAt: true },
        },
      },
    })
    return documents.map((document) => ({
      ...this.toDocumentRow(document),
      role: this.mapWorkspaceMemberRole(document.workspace.members[0]?.role),
      is_favorite: document.userPrefs[0]?.isFavorite ?? false,
      last_opened_at: document.userPrefs[0]?.lastOpenedAt ?? null,
    }))
  }

  async listForUserInWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<DocumentListRow[]> {
    const documents = await this.prisma.client.document.findMany({
      where: {
        deletedAt: null,
        workspaceId,
        workspace: { members: { some: { userId } } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        workspace: {
          include: {
            members: { where: { userId }, select: { role: true } },
          },
        },
        userPrefs: {
          where: { userId },
          select: { isFavorite: true, lastOpenedAt: true },
        },
      },
    })
    return documents.map((document) => ({
      ...this.toDocumentRow(document),
      role: this.mapWorkspaceMemberRole(document.workspace.members[0]?.role),
      is_favorite: document.userPrefs[0]?.isFavorite ?? false,
      last_opened_at: document.userPrefs[0]?.lastOpenedAt ?? null,
    }))
  }

  async listPublishedInWorkspace(workspaceId: string): Promise<DocumentRow[]> {
    const documents = await this.prisma.client.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        publicationStatus: "published",
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    })
    return documents.map((document) => this.toDocumentRow(document))
  }

  private mapWorkspaceMemberRole(role: string | undefined): DocumentRole {
    if (role === "owner") return "owner"
    if (role === "viewer") return "viewer"
    if (role === "admin" || role === "editor") return "editor"
    return "viewer"
  }

  async listTrashedForUser(userId: string): Promise<DocumentListRow[]> {
    const documents = await this.prisma.client.document.findMany({
      where: {
        deletedAt: { not: null },
        workspace: { members: { some: { userId } } },
      },
      orderBy: { deletedAt: "desc" },
      include: {
        workspace: {
          include: {
            members: { where: { userId }, select: { role: true } },
          },
        },
        userPrefs: {
          where: { userId },
          select: { isFavorite: true, lastOpenedAt: true },
        },
      },
    })
    return documents.map((document) => ({
      ...this.toDocumentRow(document),
      role: this.mapWorkspaceMemberRole(document.workspace.members[0]?.role),
      is_favorite: document.userPrefs[0]?.isFavorite ?? false,
      last_opened_at: document.userPrefs[0]?.lastOpenedAt ?? null,
    }))
  }

  async listFavoritesForUser(userId: string): Promise<DocumentListRow[]> {
    const rows = await this.listForUser(userId)
    return rows.filter((row) => row.is_favorite)
  }

  async listRecentForUser(
    userId: string,
    limit = 10
  ): Promise<DocumentListRow[]> {
    const rows = await this.listForUser(userId)
    return rows
      .filter((row) => row.last_opened_at)
      .sort(
        (a, b) =>
          (b.last_opened_at?.getTime() ?? 0) -
          (a.last_opened_at?.getTime() ?? 0)
      )
      .slice(0, limit)
  }

  async upsertUserPref(
    userId: string,
    documentId: string,
    data: { isFavorite?: boolean; lastOpenedAt?: Date }
  ): Promise<void> {
    await this.prisma.client.userDocumentPref.upsert({
      where: {
        userId_documentId: { userId, documentId },
      },
      create: {
        userId,
        documentId,
        isFavorite: data.isFavorite ?? false,
        lastOpenedAt: data.lastOpenedAt ?? null,
      },
      update: {
        ...(data.isFavorite !== undefined
          ? { isFavorite: data.isFavorite }
          : {}),
        ...(data.lastOpenedAt !== undefined
          ? { lastOpenedAt: data.lastOpenedAt }
          : {}),
      },
    })
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

  async softDelete(documentId: string): Promise<boolean> {
    const result = await this.prisma.client.document.updateMany({
      where: { id: documentId, deletedAt: null },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    })
    return result.count > 0
  }

  async restore(documentId: string): Promise<boolean> {
    const result = await this.prisma.client.document.updateMany({
      where: { id: documentId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedAt: new Date() },
    })
    return result.count > 0
  }

  async remove(documentId: string): Promise<boolean> {
    const result = await this.prisma.client.document.deleteMany({
      where: { id: documentId },
    })
    return result.count > 0
  }

  /** 统计用户作为 owner 且未进回收站的文档数，用于每人容量上限。 */
  async countOwnedActive(userId: string): Promise<number> {
    return this.prisma.client.document.count({
      where: { ownerId: userId, deletedAt: null },
    })
  }

  async createInWorkspace(
    workspaceId: string,
    userId: string,
    parent?: DocumentRow
  ): Promise<DocumentRow> {
    return this.prisma.client.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          workspaceId,
          parentId: parent?.id ?? null,
          depth: parent ? (parent.depth ?? 1) + 1 : 1,
          title: "未命名文档",
          ownerId: userId,
        },
      })
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { updatedAt: new Date() },
      })
      return this.toDocumentRow(document)
    })
  }

  /** @deprecated 使用 createInWorkspace；保留供旧测试路径调用。 */
  async createForOwner(userId: string): Promise<DocumentRow> {
    throw new Error("createForOwner is deprecated; use createInWorkspace")
  }

  async createChild(parent: DocumentRow, userId: string): Promise<DocumentRow> {
    return this.createInWorkspace(parent.workspace_id, userId, parent)
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

  async countByPublicationStatus(): Promise<{
    published: number
    draft: number
    pending: number
  }> {
    const [published, draft, pending] = await Promise.all([
      this.prisma.client.document.count({
        where: { publicationStatus: "published" },
      }),
      this.prisma.client.document.count({
        where: { publicationStatus: "draft" },
      }),
      this.prisma.client.document.count({
        where: { publicationStatus: "pending" },
      }),
    ])
    return { published, draft, pending }
  }

  async listWorkspaceNames(): Promise<string[]> {
    const rows = await this.prisma.client.workspace.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    })
    return rows.map((row) => row.name)
  }

  async listAdminArticles(filters: {
    status?: PublicationStatus
    category?: string
    query?: string
  }): Promise<
    Array<{
      row: DocumentRow
      authorName: string | null
      workspaceName: string
    }>
  > {
    const query = filters.query?.trim().toLowerCase()
    const documents = await this.prisma.client.document.findMany({
      where: {
        ...(filters.status ? { publicationStatus: filters.status } : {}),
        ...(filters.category ? { workspace: { name: filters.category } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { displayName: true } },
        workspace: { select: { name: true } },
      },
    })
    return documents
      .map((document) => ({
        row: this.toDocumentRow(document),
        authorName: document.owner?.displayName ?? null,
        workspaceName: document.workspace.name,
      }))
      .filter((article) => {
        if (!query) return true
        const haystack =
          `${article.row.title} ${article.authorName ?? ""} ${article.row.id}`.toLowerCase()
        return haystack.includes(query)
      })
  }
}

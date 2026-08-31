import { Inject, Injectable } from "@nestjs/common"
import { UserRepository } from "../auth/user.repository"
import type { PublicationStatus } from "../documents/document-types"
import { DocumentsRepository } from "../documents/documents.repository"
import { AdminAccess } from "./admin.helpers"
import type { AdminArticle, AdminDashboardStats } from "./admin.types"

@Injectable()
export class AdminArticlesService {
  constructor(
    @Inject(DocumentsRepository) private readonly documents: DocumentsRepository,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(AdminAccess) private readonly access: AdminAccess
  ) {}

  async getDashboardStats(adminUserId: string): Promise<AdminDashboardStats> {
    await this.access.assertAdmin(adminUserId)
    const [counts, totalUsers] = await Promise.all([
      this.documents.countByPublicationStatus(),
      this.users.countUsers(),
    ])
    return {
      publishedCount: counts.published,
      draftCount: counts.draft,
      pendingCount: counts.pending,
      totalUsers,
    }
  }

  async listArticles(
    adminUserId: string,
    filters: {
      status?: PublicationStatus
      category?: string
      query?: string
    }
  ): Promise<AdminArticle[]> {
    await this.access.assertAdmin(adminUserId)
    const rows = await this.documents.listAdminArticles(filters)
    return rows.map((article) => ({
      id: article.row.id,
      title: article.row.title,
      category: article.workspaceName,
      author: article.authorName,
      publicationStatus: article.row.publication_status ?? "draft",
      updatedAt: article.row.updated_at,
      publishedAt: article.row.published_at ?? null,
    }))
  }

  async listCategories(adminUserId: string): Promise<string[]> {
    await this.access.assertAdmin(adminUserId)
    return this.documents.listWorkspaceNames()
  }
}

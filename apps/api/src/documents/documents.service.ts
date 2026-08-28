import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common"
import {
  documentFromYjs,
  documentToPlainText,
  collectMentionIds,
} from "@workspace/editor-core"
import { UserRepository } from "../auth/user.repository"
import { YjsPersistenceService } from "../collaboration/yjs-persistence.service"
import type {
  DocumentMetadata,
  DocumentRole,
  DocumentRow,
  DocumentGraphNode,
  PublishedArticle,
  PublishedArticleDetail,
} from "./document-types"
import { DocumentsRepository } from "./documents.repository"

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentsRepository)
    private readonly documents: DocumentsRepository,
    @Optional()
    @Inject(UserRepository)
    private readonly users?: UserRepository,
    @Optional()
    @Inject(YjsPersistenceService)
    private readonly yjsPersistence?: YjsPersistenceService
  ) {}

  getMemberRole(
    documentId: string,
    userId: string
  ): Promise<DocumentRole | null> {
    return this.documents.getMemberRole(documentId, userId)
  }

  async assertCanRead(
    documentId: string,
    userId: string
  ): Promise<DocumentRole> {
    const role = await this.getMemberRole(documentId, userId)
    if (!role) {
      throw new ForbiddenException("Not a document member")
    }
    return role
  }

  async assertCanWrite(
    documentId: string,
    userId: string
  ): Promise<DocumentRole> {
    const role = await this.assertCanRead(documentId, userId)
    if (role === "viewer") {
      throw new ForbiddenException("Viewer cannot write to document")
    }
    return role
  }

  async getDocument(
    documentId: string,
    userId: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanRead(documentId, userId)
    const row = await this.documents.findById(documentId)
    if (!row) {
      throw new NotFoundException("Document not found")
    }
    return this.toMetadata(row, role)
  }

  async listDocuments(userId: string): Promise<DocumentMetadata[]> {
    const rows = await this.documents.listForUser(userId)
    return rows.map((row) => this.toMetadata(row, row.role))
  }

  /** 聚合用户可见文档及其 @mention 引用关系，供关系图谱可视化。 */
  async listDocumentGraph(userId: string): Promise<DocumentGraphNode[]> {
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }

    const rows = await this.documents.listForUser(userId)
    const accessibleIds = new Set(rows.map((row) => row.id))
    const nodes: DocumentGraphNode[] = []

    for (const row of rows) {
      const yDoc = await this.yjsPersistence.loadDocument(row.id)
      try {
        const content = documentFromYjs(yDoc)
        const mentionIds = collectMentionIds(content)
        const links = [...new Set(mentionIds)].filter(
          (id) => accessibleIds.has(id) && id !== row.id
        )
        nodes.push({ id: row.id, title: row.title, links })
      } finally {
        yDoc.destroy()
      }
    }

    return nodes
  }

  async createDocument(userId: string): Promise<DocumentMetadata> {
    const row = await this.documents.createForOwner(userId)
    return this.toMetadata(row, "owner")
  }

  async renameDocument(
    documentId: string,
    userId: string,
    title: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanWrite(documentId, userId)
    const nextTitle = title.trim()
    if (!nextTitle) throw new Error("Document title cannot be empty")
    const row = await this.documents.rename(documentId, nextTitle)
    if (!row) throw new NotFoundException("Document not found")
    return this.toMetadata(row, role)
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    await this.assertCanWrite(documentId, userId)
    const removed = await this.documents.remove(documentId)
    if (!removed) throw new NotFoundException("Document not found")
  }

  async createChildDocument(
    parentId: string,
    userId: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanWrite(parentId, userId)
    const parent = await this.documents.findById(parentId)
    if (!parent) throw new NotFoundException("Parent document not found")
    if ((parent.depth ?? 1) >= 3) {
      throw new ForbiddenException("Documents can be nested up to three levels")
    }
    const row = await this.documents.createChild(parent, userId)
    return this.toMetadata(row, role)
  }

  async submitPublication(
    documentId: string,
    userId: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanWrite(documentId, userId)
    const row = await this.documents.submitPublication(documentId)
    if (!row) {
      throw new ConflictException("Document is not a draft")
    }
    return this.toMetadata(row, role)
  }

  async approvePublication(
    documentId: string,
    adminUserId: string
  ): Promise<DocumentMetadata> {
    await this.assertAdmin(adminUserId)
    const row = await this.documents.approvePublication(documentId, adminUserId)
    if (!row) throw new ConflictException("Document is not pending approval")
    return this.toMetadata(row, "owner")
  }

  async rejectPublication(
    documentId: string,
    adminUserId: string,
    reason: string
  ): Promise<DocumentMetadata> {
    await this.assertAdmin(adminUserId)
    const trimmedReason = reason.trim()
    if (!trimmedReason)
      throw new ConflictException("Rejection reason is required")
    const row = await this.documents.rejectPublication(
      documentId,
      trimmedReason
    )
    if (!row) throw new ConflictException("Document is not pending approval")
    return this.toMetadata(row, "owner")
  }

  async listPendingPublications(userId: string): Promise<DocumentMetadata[]> {
    await this.assertAdmin(userId)
    const rows = await this.documents.listPendingPublications()
    return rows.map((row) => this.toMetadata(row, "owner"))
  }

  async listPublishedArticles(): Promise<PublishedArticle[]> {
    const articles = await this.documents.listPublishedArticles()
    // Never return internal approval metadata from the public square endpoint.
    return articles.flatMap((article) =>
      article.row.published_at
        ? [
            {
              id: article.row.id,
              title: article.row.title,
              author: article.authorName,
              authorColor: article.authorColor,
              publishedAt: article.row.published_at,
              excerpt: "",
              category: article.workspaceName,
            },
          ]
        : []
    )
  }

  async getPublishedArticle(
    documentId: string
  ): Promise<PublishedArticleDetail> {
    const article = await this.documents.findPublishedById(documentId)
    if (!article?.row.published_at) {
      throw new NotFoundException("Published article not found")
    }
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }

    const yDoc = await this.yjsPersistence.loadDocument(documentId)
    try {
      const content = documentFromYjs(yDoc)
      const excerpt = documentToPlainText(content).slice(0, 200)
      return {
        id: article.row.id,
        title: article.row.title,
        author: article.authorName,
        authorColor: article.authorColor,
        publishedAt: article.row.published_at,
        excerpt,
        category: article.workspaceName,
        content,
      }
    } finally {
      yDoc.destroy()
    }
  }

  private async assertAdmin(userId: string): Promise<void> {
    const user = await this.users?.findById(userId)
    if (user?.role !== "admin") {
      throw new ForbiddenException("Administrator role required")
    }
  }

  private toMetadata(row: DocumentRow, role: DocumentRole): DocumentMetadata {
    // Old rows and test fixtures without the migration fields are drafts.
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id ?? null,
      depth: row.depth ?? 1,
      title: row.title,
      role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publicationStatus: row.publication_status ?? "draft",
      rejectionReason: row.rejection_reason ?? null,
      publishedAt: row.published_at ?? null,
      publishedBy: row.published_by ?? null,
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common"
import {
  documentFromYjs,
  documentFromYjsOrStarter,
  documentToPlainText,
  collectMentionIds,
  createBlockSchemaYDoc,
  blocksToMarkdown,
  markdownToBlocks,
} from "@xtai-notion/editor-core/server"
import type { Block } from "@xtai-notion/editor-core/server"
import { UserRepository } from "../auth/user.repository"
import { YjsPersistenceService } from "../collaboration/yjs-persistence.service"
import type {
  DocumentCollaborationPolicy,
  DocumentMetadata,
  DocumentRole,
  DocumentRow,
  DocumentGraphNode,
  DocumentSearchResult,
  DocumentVersionSummary,
  PublishedArticle,
  PublishedArticleDetail,
} from "./document-types"
import { WorkspaceRepository } from "../workspaces/workspace.repository"
import { isUuid } from "../workspaces/workspace-slug.util"
import {
  mapWorkspaceRoleToDocumentRole,
  type PublicWorkspaceDocumentSummary,
} from "../workspaces/workspace.types"
import { DocumentsRepository } from "./documents.repository"
import { ShareLinkRepository } from "./share-link.repository"

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentsRepository)
    private readonly documents: DocumentsRepository,
    @Inject(WorkspaceRepository)
    private readonly workspaces: WorkspaceRepository,
    @Optional()
    @Inject(UserRepository)
    private readonly users?: UserRepository,
    @Optional()
    @Inject(YjsPersistenceService)
    private readonly yjsPersistence?: YjsPersistenceService,
    @Optional()
    @Inject(ShareLinkRepository)
    private readonly shareLinks?: ShareLinkRepository
  ) {}

  async resolveCollaborationPolicy(
    documentId: string
  ): Promise<DocumentCollaborationPolicy> {
    const [memberCount, activeShareLink] = await Promise.all([
      this.documents.countMembers(documentId),
      this.shareLinks
        ? this.shareLinks.findActiveByDocumentId(documentId)
        : Promise.resolve(null),
    ])
    const hasActiveShareLink = activeShareLink !== null
    const mode = memberCount > 1 || hasActiveShareLink ? "realtime" : "solo"
    return { mode, memberCount, hasActiveShareLink }
  }

  /** 从 Yjs 持久层读取 Block[]；调用方须已完成鉴权。 */
  private async loadDocumentBlocks(documentId: string): Promise<Block[]> {
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }
    const yDoc = await this.yjsPersistence.loadDocument(documentId)
    try {
      // 新建文档可能尚无 Yjs 快照，需回退 starter 而非抛错。
      return documentFromYjsOrStarter(yDoc)
    } finally {
      yDoc.destroy()
    }
  }

  async getMemberRole(
    documentId: string,
    userId: string
  ): Promise<DocumentRole | null> {
    const row = await this.documents.findById(documentId)
    if (!row) return null
    const workspaceRole = await this.workspaces.getMemberRole(
      row.workspace_id,
      userId
    )
    if (workspaceRole) {
      return mapWorkspaceRoleToDocumentRole(workspaceRole)
    }
    // 兼容迁移前写入 document_member 的历史数据（P2 后新分享不再写该表）
    const legacyRole = await this.documents.getMemberRole(documentId, userId)
    if (legacyRole) {
      return legacyRole
    }
    const workspace = await this.workspaces.findById(row.workspace_id)
    if (
      workspace?.visibility === "public" &&
      row.publication_status === "published"
    ) {
      return "viewer"
    }
    return null
  }

  async assertCanRead(
    documentId: string,
    userId: string
  ): Promise<DocumentRole> {
    const role = await this.getMemberRole(documentId, userId)
    if (!role) {
      throw new ForbiddenException("不是该知识库成员")
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
    const [row, collaboration] = await Promise.all([
      this.documents.findById(documentId),
      this.resolveCollaborationPolicy(documentId),
    ])
    if (!row) {
      throw new NotFoundException("Document not found")
    }
    const metadata = this.toMetadata(row, role, collaboration)
    if (collaboration.mode === "solo") {
      metadata.content = await this.loadDocumentBlocks(documentId)
    }
    return metadata
  }

  async getDocumentContent(
    documentId: string,
    userId: string
  ): Promise<Block[]> {
    await this.assertCanRead(documentId, userId)
    return this.loadDocumentBlocks(documentId)
  }

  async exportMarkdown(documentId: string, userId: string): Promise<string> {
    // 先做阅读鉴权再加载 Yjs，避免未授权请求打到协作持久层。
    await this.assertCanRead(documentId, userId)
    const markdown = blocksToMarkdown(
      await this.loadDocumentBlocks(documentId)
    ).trim()
    if (!markdown) {
      throw new BadRequestException("文档没有可索引的正文")
    }
    return markdown
  }

  async saveDocumentContent(
    documentId: string,
    userId: string,
    content: Block[]
  ): Promise<void> {
    await this.assertCanWrite(documentId, userId)
    const collaboration = await this.resolveCollaborationPolicy(documentId)
    if (collaboration.mode !== "solo") {
      throw new ConflictException(
        "Document uses realtime collaboration; REST save is disabled"
      )
    }
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }
    await this.yjsPersistence.replaceDocumentContent(documentId, content)
  }

  async listDocuments(
    userId: string,
    workspaceId?: string
  ): Promise<DocumentMetadata[]> {
    const rows = workspaceId
      ? await this.documents.listForUserInWorkspace(userId, workspaceId)
      : await this.documents.listForUser(userId)
    return rows.map((row) => this.toMetadata(row, row.role))
  }

  async listDocumentsInWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<DocumentMetadata[]> {
    const role = await this.workspaces.getMemberRole(workspaceId, userId)
    if (!role) {
      throw new ForbiddenException("不是该知识库成员")
    }
    return this.listDocuments(userId, workspaceId)
  }

  private async resolvePublicWorkspaceId(
    key: string
  ): Promise<string | null> {
    const trimmed = key.trim()
    if (!trimmed) return null
    if (isUuid(trimmed)) {
      const row = await this.workspaces.findById(trimmed)
      return row?.id ?? null
    }
    const bySlug = await this.workspaces.findBySlug(trimmed.toLowerCase())
    return bySlug?.id ?? null
  }

  async listPublicWorkspaceDocuments(
    workspaceKey: string
  ): Promise<PublicWorkspaceDocumentSummary[]> {
    const workspaceId = await this.resolvePublicWorkspaceId(workspaceKey)
    if (!workspaceId) {
      throw new NotFoundException("知识库不存在或未公开")
    }
    const workspace = await this.workspaces.findById(workspaceId)
    if (!workspace || workspace.visibility !== "public") {
      throw new NotFoundException("知识库不存在或未公开")
    }
    const rows = await this.documents.listPublishedInWorkspace(workspaceId)
    return rows.flatMap((row) =>
      row.published_at
        ? [
            {
              id: row.id,
              title: row.title,
              publishedAt: row.published_at.toISOString(),
            },
          ]
        : []
    )
  }

  async listTrashedDocuments(userId: string): Promise<DocumentMetadata[]> {
    const rows = await this.documents.listTrashedForUser(userId)
    return rows.map((row) => this.toMetadata(row, row.role))
  }

  async listFavoriteDocuments(userId: string): Promise<DocumentMetadata[]> {
    const rows = await this.documents.listFavoritesForUser(userId)
    return rows.map((row) => this.toMetadata(row, row.role))
  }

  async listRecentDocuments(userId: string): Promise<DocumentMetadata[]> {
    const rows = await this.documents.listRecentForUser(userId)
    return rows.map((row) => this.toMetadata(row, row.role))
  }

  async searchDocuments(
    userId: string,
    query: string
  ): Promise<DocumentSearchResult[]> {
    const trimmed = query.trim().toLowerCase()
    const rows = await this.documents.listForUser(userId)
    if (!trimmed) {
      return rows.map((row) => ({
        ...this.toMetadata(row, row.role),
        matchIn: "title" as const,
      }))
    }

    const results: DocumentSearchResult[] = []
    for (const row of rows) {
      const titleMatch = row.title.toLowerCase().includes(trimmed)
      const idMatch = row.id.toLowerCase().includes(trimmed)
      if (titleMatch) {
        results.push({
          ...this.toMetadata(row, row.role),
          matchIn: "title",
        })
        continue
      }
      if (idMatch) {
        results.push({
          ...this.toMetadata(row, row.role),
          matchIn: "id",
        })
        continue
      }

      // 标题/ID 未命中时再加载 Yjs 正文做全文检索
      if (!this.yjsPersistence) continue
      const yDoc = await this.yjsPersistence.loadDocument(row.id)
      try {
        const plainText = documentToPlainText(documentFromYjsOrStarter(yDoc))
        if (!plainText.toLowerCase().includes(trimmed)) continue
        results.push({
          ...this.toMetadata(row, row.role),
          matchIn: "body",
          matchExcerpt: buildSearchExcerpt(plainText, trimmed),
        })
      } finally {
        yDoc.destroy()
      }
    }
    return results
  }

  async updateDocumentPref(
    documentId: string,
    userId: string,
    pref: { isFavorite?: boolean; recordOpened?: boolean }
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanRead(documentId, userId)
    await this.documents.upsertUserPref(userId, documentId, {
      ...(pref.isFavorite !== undefined ? { isFavorite: pref.isFavorite } : {}),
      ...(pref.recordOpened ? { lastOpenedAt: new Date() } : {}),
    })
    const row = await this.documents.findById(documentId)
    if (!row) throw new NotFoundException("Document not found")
    const listRow = await this.documents.listForUser(userId)
    const match = listRow.find((item) => item.id === documentId)
    return this.toMetadata(
      match ?? { ...row, role, is_favorite: false, last_opened_at: null },
      role
    )
  }

  async restoreDocument(
    documentId: string,
    userId: string
  ): Promise<DocumentMetadata> {
    await this.assertCanWrite(documentId, userId)
    const restored = await this.documents.restore(documentId)
    if (!restored) throw new NotFoundException("Document not in trash")
    const row = await this.documents.findById(documentId)
    if (!row) throw new NotFoundException("Document not found")
    const role = await this.getMemberRole(documentId, userId)
    return this.toMetadata(
      { ...row, is_favorite: false, last_opened_at: null },
      role ?? "owner"
    )
  }

  async purgeDocument(documentId: string, userId: string): Promise<void> {
    await this.assertCanWrite(documentId, userId)
    const trashed = await this.documents.findTrashedById(documentId)
    if (!trashed) throw new NotFoundException("Document not in trash")
    const removed = await this.documents.remove(documentId)
    if (!removed) throw new NotFoundException("Document not found")
  }

  async importMarkdown(
    userId: string,
    title: string,
    markdown: string
  ): Promise<DocumentMetadata> {
    const workspace = await this.resolveDefaultWorkspace(userId)
    return this.importMarkdownInWorkspace(
      userId,
      workspace.id,
      title,
      markdown
    )
  }

  async importMarkdownInWorkspace(
    userId: string,
    workspaceId: string,
    title: string,
    markdown: string
  ): Promise<DocumentMetadata> {
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }
    const trimmed = markdown.trim()
    if (!trimmed) {
      throw new BadRequestException("Markdown 内容不能为空")
    }
    const workspaceRole = await this.workspaces.getMemberRole(
      workspaceId,
      userId
    )
    if (!workspaceRole) {
      throw new ForbiddenException("不是该知识库成员")
    }
    if (workspaceRole === "viewer") {
      throw new ForbiddenException("查看者无法导入文档")
    }
    const blocks = markdownToBlocks(trimmed)
    const row = await this.documents.createInWorkspace(workspaceId, userId)
    const nextTitle = title.trim() || "导入的文档"
    await this.documents.rename(row.id, nextTitle)
    await this.yjsPersistence.seedInitialContent(row.id, blocks)
    return this.toMetadata(
      {
        ...row,
        title: nextTitle,
        is_favorite: false,
        last_opened_at: null,
      },
      mapWorkspaceRoleToDocumentRole(workspaceRole)
    )
  }

  async listDocumentVersions(
    documentId: string,
    userId: string
  ): Promise<DocumentVersionSummary[]> {
    await this.assertCanRead(documentId, userId)
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }
    return this.yjsPersistence.listVersions(documentId)
  }

  async saveDocumentVersion(
    documentId: string,
    userId: string
  ): Promise<DocumentVersionSummary> {
    await this.assertCanWrite(documentId, userId)
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }
    return this.yjsPersistence.saveVersion(documentId)
  }

  async restoreDocumentVersion(
    documentId: string,
    versionId: string,
    userId: string
  ): Promise<void> {
    await this.assertCanWrite(documentId, userId)
    if (!this.yjsPersistence) {
      throw new Error("Collaboration persistence unavailable")
    }
    try {
      await this.yjsPersistence.restoreVersion(documentId, versionId)
    } catch {
      throw new NotFoundException("Version not found")
    }
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
        const content = documentFromYjsOrStarter(yDoc)
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
    const workspace = await this.resolveDefaultWorkspace(userId)
    return this.createDocumentInWorkspace(userId, workspace.id)
  }

  async createDocumentInWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<DocumentMetadata> {
    const workspaceRole = await this.workspaces.getMemberRole(
      workspaceId,
      userId
    )
    if (!workspaceRole) {
      throw new ForbiddenException("不是该知识库成员")
    }
    if (workspaceRole === "viewer") {
      throw new ForbiddenException("查看者无法创建文档")
    }
    const row = await this.documents.createInWorkspace(workspaceId, userId)
    return this.toMetadata(
      row,
      mapWorkspaceRoleToDocumentRole(workspaceRole)
    )
  }

  async createChildDocumentInWorkspace(
    parentId: string,
    userId: string,
    workspaceId: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanWrite(parentId, userId)
    const parent = await this.documents.findById(parentId)
    if (!parent) throw new NotFoundException("Parent document not found")
    if (parent.workspace_id !== workspaceId) {
      throw new ForbiddenException("子文档必须与父文档在同一知识库")
    }
    if ((parent.depth ?? 1) >= 3) {
      throw new ForbiddenException("Documents can be nested up to three levels")
    }
    const row = await this.documents.createChild(parent, userId)
    return this.toMetadata(row, role)
  }

  /** 默认知识库：最近更新的 owner 库，否则自动创建「我的知识库」。 */
  private async resolveDefaultWorkspace(userId: string) {
    const existing = await this.workspaces.findDefaultForUser(userId)
    if (existing) return existing
    return this.workspaces.createForUser("我的知识库", userId)
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
    const removed = await this.documents.softDelete(documentId)
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

  private toMetadata(
    row: DocumentRow & {
      is_favorite?: boolean
      last_opened_at?: Date | null
    },
    role: DocumentRole,
    collaboration: DocumentCollaborationPolicy = {
      mode: "solo",
      memberCount: 1,
      hasActiveShareLink: false,
    }
  ): DocumentMetadata {
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
      isFavorite: row.is_favorite ?? false,
      lastOpenedAt: row.last_opened_at ?? null,
      deletedAt: row.deleted_at ?? null,
      collaboration,
    }
  }
}

/** 截取关键词附近的正文片段，供搜索结果预览 */
function buildSearchExcerpt(text: string, query: string, radius = 48): string {
  const normalized = text.trim()
  if (!normalized) return ""
  const index = normalized.toLowerCase().indexOf(query.toLowerCase())
  if (index < 0) return normalized.slice(0, radius * 2)
  const start = Math.max(0, index - radius)
  const end = Math.min(normalized.length, index + query.length + radius)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < normalized.length ? "…" : ""
  return `${prefix}${normalized.slice(start, end)}${suffix}`
}

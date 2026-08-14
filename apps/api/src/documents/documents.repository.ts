import { Inject, Injectable } from "@nestjs/common"
import { DatabaseService } from "../database/database.service"
import type {
  DocumentListRow,
  DocumentRole,
  DocumentRow,
} from "./document-types"
import { isDocumentRole } from "./document-types"

@Injectable()
export class DocumentsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async getMemberRole(
    documentId: string,
    userId: string
  ): Promise<DocumentRole | null> {
    const result = await this.db.query<{ role: string }>(
      `SELECT role FROM document_member
       WHERE document_id = $1 AND user_id = $2
       LIMIT 1`,
      [documentId, userId]
    )
    const role = result.rows[0]?.role
    return isDocumentRole(role) ? role : null
  }

  async findById(documentId: string): Promise<DocumentRow | null> {
    const result = await this.db.query<DocumentRow>(
      `SELECT id, workspace_id, title, parent_id, depth, created_at, updated_at,
              publication_status, rejection_reason, published_at, published_by
       FROM document
       WHERE id = $1
       LIMIT 1`,
      [documentId]
    )
    return result.rows[0] ?? null
  }

  async listForUser(userId: string): Promise<DocumentListRow[]> {
    const result = await this.db.query<DocumentListRow>(
      `SELECT d.id, d.workspace_id, d.title, d.parent_id, d.depth, d.created_at, d.updated_at,
              d.publication_status, d.rejection_reason, d.published_at, d.published_by, dm.role
       FROM document d
       INNER JOIN document_member dm ON dm.document_id = d.id
       WHERE dm.user_id = $1
       ORDER BY d.updated_at DESC, d.created_at DESC`,
      [userId]
    )
    return result.rows
  }

  async rename(documentId: string, title: string): Promise<DocumentRow | null> {
    const result = await this.db.query<DocumentRow>(
      `UPDATE document SET title = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                 publication_status, rejection_reason, published_at, published_by`,
      [documentId, title]
    )
    return result.rows[0] ?? null
  }

  async remove(documentId: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM document WHERE id = $1`, [
      documentId,
    ])
    return (result.rowCount ?? 0) > 0
  }

  async createForOwner(userId: string): Promise<DocumentRow> {
    return this.db.withTransaction(async (client) => {
      const workspaceResult = await client.query<{ id: string }>(
        "INSERT INTO workspace (name) VALUES ($1) RETURNING id",
        ["个人空间"]
      )
      const workspaceId = workspaceResult.rows[0]?.id
      if (!workspaceId) {
        throw new Error("Failed to create workspace")
      }

      const documentResult = await client.query<DocumentRow>(
        `INSERT INTO document (workspace_id, title, depth, owner_id) VALUES ($1, $2, 1, $3)
         RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                   publication_status, rejection_reason, published_at, published_by`,
        [workspaceId, "未命名文档", userId]
      )
      const document = documentResult.rows[0]
      if (!document) {
        throw new Error("Failed to create document")
      }

      await client.query(
        `INSERT INTO document_member (document_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [document.id, userId]
      )
      return document
    })
  }

  async createChild(parent: DocumentRow, userId: string): Promise<DocumentRow> {
    return this.db.withTransaction(async (client) => {
      const result = await client.query<DocumentRow>(
        `INSERT INTO document (workspace_id, parent_id, depth, title, owner_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                   publication_status, rejection_reason, published_at, published_by`,
        [
          parent.workspace_id,
          parent.id,
          (parent.depth ?? 1) + 1,
          "未命名文档",
          userId,
        ]
      )
      const document = result.rows[0]
      if (!document) throw new Error("Failed to create child document")
      await client.query(
        `INSERT INTO document_member (document_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [document.id, userId]
      )
      return document
    })
  }

  async submitPublication(documentId: string): Promise<DocumentRow | null> {
    const result = await this.db.query<DocumentRow>(
      // The state predicate makes duplicate submissions and stale requests harmless.
      `UPDATE document
       SET publication_status = 'pending', rejection_reason = NULL, updated_at = NOW()
       WHERE id = $1 AND publication_status = 'draft'
       RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                 publication_status, rejection_reason, published_at, published_by`,
      [documentId]
    )
    return result.rows[0] ?? null
  }

  async approvePublication(
    documentId: string,
    adminUserId: string
  ): Promise<DocumentRow | null> {
    const result = await this.db.query<DocumentRow>(
      // Compare-and-set prevents a second admin from approving stale work.
      `UPDATE document
       SET publication_status = 'published', published_at = NOW(),
           published_by = $2, rejection_reason = NULL, updated_at = NOW()
       WHERE id = $1 AND publication_status = 'pending'
       RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                 publication_status, rejection_reason, published_at, published_by`,
      [documentId, adminUserId]
    )
    return result.rows[0] ?? null
  }

  async rejectPublication(
    documentId: string,
    reason: string
  ): Promise<DocumentRow | null> {
    const result = await this.db.query<DocumentRow>(
      // Only the pending revision can be returned to a writable draft.
      `UPDATE document
       SET publication_status = 'draft', rejection_reason = $2, updated_at = NOW()
       WHERE id = $1 AND publication_status = 'pending'
       RETURNING id, workspace_id, title, parent_id, depth, created_at, updated_at,
                 publication_status, rejection_reason, published_at, published_by`,
      [documentId, reason]
    )
    return result.rows[0] ?? null
  }

  async listPendingPublications(): Promise<DocumentRow[]> {
    const result = await this.db.query<DocumentRow>(
      `SELECT id, workspace_id, title, parent_id, depth, created_at, updated_at,
              publication_status, rejection_reason, published_at, published_by
       FROM document
       WHERE publication_status = 'pending'
       ORDER BY updated_at ASC`
    )
    return result.rows
  }

  async listPublishedArticles(): Promise<DocumentRow[]> {
    const result = await this.db.query<DocumentRow>(
      `SELECT id, workspace_id, title, parent_id, depth, created_at, updated_at,
              publication_status, rejection_reason, published_at, published_by
       FROM document
       WHERE publication_status = 'published'
       ORDER BY published_at DESC`
    )
    return result.rows
  }
}

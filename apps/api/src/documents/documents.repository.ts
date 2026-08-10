import { Inject, Injectable } from "@nestjs/common"
import { DatabaseService } from "../database/database.service"
import type { DocumentRole, DocumentRow } from "./document-types"
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
      `SELECT id, workspace_id, title, created_at, updated_at
       FROM document
       WHERE id = $1
       LIMIT 1`,
      [documentId]
    )
    return result.rows[0] ?? null
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
        `INSERT INTO document (workspace_id, title) VALUES ($1, $2)
         RETURNING id, workspace_id, title, created_at, updated_at`,
        [workspaceId, "未命名文档"]
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
}

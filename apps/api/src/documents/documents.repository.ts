import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../database/database.service"
import type { DocumentRole, DocumentRow } from "./document-types"
import { isDocumentRole } from "./document-types"

@Injectable()
export class DocumentsRepository {
  constructor(private readonly db: DatabaseService) {}

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
}

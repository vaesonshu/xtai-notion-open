import { Inject, Injectable } from "@nestjs/common"
import { DatabaseService } from "../database/database.service"
import type { ShareLinkRow } from "./share-link-types"

@Injectable()
export class ShareLinkRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findActiveByDocumentId(
    documentId: string
  ): Promise<ShareLinkRow | null> {
    const result = await this.db.query<ShareLinkRow>(
      `SELECT token, document_id, created_by, created_at, revoked_at
       FROM document_share_link
       WHERE document_id = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [documentId]
    )
    return result.rows[0] ?? null
  }

  async findActiveByToken(token: string): Promise<ShareLinkRow | null> {
    const result = await this.db.query<ShareLinkRow>(
      `SELECT token, document_id, created_by, created_at, revoked_at
       FROM document_share_link
       WHERE token = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [token]
    )
    return result.rows[0] ?? null
  }

  async create(
    documentId: string,
    createdBy: string,
    token: string
  ): Promise<ShareLinkRow> {
    const result = await this.db.query<ShareLinkRow>(
      `INSERT INTO document_share_link (token, document_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING token, document_id, created_by, created_at, revoked_at`,
      [token, documentId, createdBy]
    )
    const row = result.rows[0]
    if (!row) throw new Error("Failed to create share link")
    return row
  }
}

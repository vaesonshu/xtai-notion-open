import { Injectable } from "@nestjs/common"
import type { DatabaseClient } from "../database/database.service"
import { DatabaseService } from "../database/database.service"

export type YjsSnapshotRow = {
  snapshot: Buffer
  sequence: string | number | bigint
}

export type YjsUpdateRow = {
  update: Buffer
  sequence: string | number | bigint
}

function toNumber(value: string | number | bigint): number {
  if (typeof value === "number") {
    return value
  }
  return Number(value)
}

@Injectable()
export class YjsPersistenceRepository {
  constructor(private readonly db: DatabaseService) {}

  async getLatestSnapshot(
    documentId: string
  ): Promise<{ snapshot: Buffer; sequence: number } | null> {
    const result = await this.db.query<YjsSnapshotRow>(
      `SELECT snapshot, sequence
       FROM yjs_snapshot
       WHERE document_id = $1
       ORDER BY sequence DESC
       LIMIT 1`,
      [documentId]
    )
    const row = result.rows[0]
    if (!row) {
      return null
    }
    return {
      snapshot: row.snapshot,
      sequence: toNumber(row.sequence),
    }
  }

  async listUpdatesAfter(
    documentId: string,
    afterSequence: number
  ): Promise<Array<{ update: Buffer; sequence: number }>> {
    const result = await this.db.query<YjsUpdateRow>(
      `SELECT "update", sequence
       FROM yjs_update
       WHERE document_id = $1 AND sequence > $2
       ORDER BY sequence ASC`,
      [documentId, afterSequence]
    )
    return result.rows.map((row) => ({
      update: row.update,
      sequence: toNumber(row.sequence),
    }))
  }

  async getMaxSequence(documentId: string): Promise<number> {
    const result = await this.db.query<{ max: string | number | bigint | null }>(
      `SELECT GREATEST(
         COALESCE((SELECT MAX(sequence) FROM yjs_snapshot WHERE document_id = $1), 0),
         COALESCE((SELECT MAX(sequence) FROM yjs_update WHERE document_id = $1), 0)
       ) AS max`,
      [documentId]
    )
    return toNumber(result.rows[0]?.max ?? 0)
  }

  async countUpdatesAfterSequence(
    documentId: string,
    sequence: number
  ): Promise<number> {
    const result = await this.db.query<{ count: string | number | bigint }>(
      `SELECT COUNT(*)::bigint AS count
       FROM yjs_update
       WHERE document_id = $1 AND sequence > $2`,
      [documentId, sequence]
    )
    return toNumber(result.rows[0]?.count ?? 0)
  }

  async insertUpdates(
    documentId: string,
    updates: Uint8Array[]
  ): Promise<{ lastSequence: number }> {
    if (updates.length === 0) {
      const max = await this.getMaxSequence(documentId)
      return { lastSequence: max }
    }

    return this.db.withTransaction(async (client) => {
      const start = await this.nextSequence(client, documentId)
      let sequence = start
      for (const update of updates) {
        await client.query(
          `INSERT INTO yjs_update (document_id, sequence, "update")
           VALUES ($1, $2, $3)`,
          [documentId, sequence, Buffer.from(update)]
        )
        sequence += 1
      }
      return { lastSequence: sequence - 1 }
    })
  }

  async insertSnapshot(
    documentId: string,
    snapshot: Uint8Array,
    sequence: number
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO yjs_snapshot (document_id, snapshot, sequence)
       VALUES ($1, $2, $3)`,
      [documentId, Buffer.from(snapshot), sequence]
    )
  }

  async deleteUpdatesUpTo(
    documentId: string,
    sequence: number
  ): Promise<void> {
    await this.db.query(
      `DELETE FROM yjs_update
       WHERE document_id = $1 AND sequence <= $2`,
      [documentId, sequence]
    )
  }

  private async nextSequence(
    client: DatabaseClient,
    documentId: string
  ): Promise<number> {
    const result = await client.query<{ max: string | number | bigint | null }>(
      `SELECT GREATEST(
         COALESCE((SELECT MAX(sequence) FROM yjs_snapshot WHERE document_id = $1), 0),
         COALESCE((SELECT MAX(sequence) FROM yjs_update WHERE document_id = $1), 0)
       ) AS max`,
      [documentId]
    )
    return toNumber(result.rows[0]?.max ?? 0) + 1
  }
}

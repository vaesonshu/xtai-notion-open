import { Inject, Injectable } from "@nestjs/common"
import { Pool } from "pg"
import { DATABASE_POOL } from "../database/database.tokens"
import { createHash } from "crypto"

@Injectable()
export class SessionRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  // Store only hash of session token for safety
  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex")
  }

  async createSession(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<{ id: string; token_hash: string }> {
    const token_hash = this.hashToken(token)
    const result = await this.pool.query(
      `INSERT INTO user_session (user_id, token_hash, expires_at) VALUES ($1,$2,$3) RETURNING id, token_hash`,
      [userId, token_hash, expiresAt]
    )
    return result.rows[0]
  }

  async findByToken(token: string) {
    const token_hash = this.hashToken(token)
    const result = await this.pool.query(
      `SELECT * FROM user_session WHERE token_hash = $1 AND expires_at > now()`,
      [token_hash]
    )
    return result.rows[0] ?? null
  }

  async revoke(token: string) {
    const token_hash = this.hashToken(token)
    await this.pool.query(`DELETE FROM user_session WHERE token_hash = $1`, [
      token_hash,
    ])
  }
}

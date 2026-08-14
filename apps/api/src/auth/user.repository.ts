import { Inject, Injectable } from "@nestjs/common"
import { Pool } from "pg"
import { DATABASE_POOL } from "../database/database.tokens"

export type UserRecord = {
  id: string
  email: string
  password_hash: string
  display_name: string
  color: string
  role: "user" | "admin"
  created_at: string
  updated_at: string
}

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async createUser(
    email: string,
    password_hash: string,
    display_name: string,
    color: string
  ): Promise<UserRecord> {
    const result = await this.pool.query<UserRecord>(
      `INSERT INTO app_user (email, password_hash, display_name, color) VALUES ($1,$2,$3,$4) RETURNING *`,
      [email, password_hash, display_name, color]
    )
    if (!result.rows[0]) throw new Error("Failed to create user")
    return result.rows[0]
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      `SELECT * FROM app_user WHERE email = $1`,
      [email]
    )
    return result.rows[0] ?? null
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      `SELECT * FROM app_user WHERE id = $1`,
      [id]
    )
    return result.rows[0] ?? null
  }
}

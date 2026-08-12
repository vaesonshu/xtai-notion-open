import { Test } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { AppModule } from "../app.module"
import { DatabaseService } from "../database/database.service"

describe("documents create (integration)", () => {
  let app: INestApplication
  let db: DatabaseService
  let baseUrl: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.listen(0)
    const address = app.getHttpServer().address()
    if (address === null || typeof address === "string") throw new Error("Expected TCP address")
    baseUrl = `http://127.0.0.1:${address.port}`
    db = app.get(DatabaseService)
  })

  afterAll(async () => {
    await app?.close()
  })

  it("register -> login -> create document sets owner_id", async () => {
    const email = `int-${Math.random().toString(36).slice(2, 8)}@example.com`
    const password = "password123"
    const displayName = "Integration User"

    // Register
    const registerRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    })
    expect(registerRes.status).toBe(200)

    // Login (sets cookie)
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    expect(loginRes.status).toBe(200)
    const cookie = loginRes.headers.get("set-cookie")
    expect(cookie).toBeTruthy()
    // extract session_token value
    const match = /session_token=([^;\s]+)/.exec(cookie ?? "")
    expect(match).toBeTruthy()
    const token = decodeURIComponent(match?.[1] ?? "")

    // Create document using cookie header so server will recognize session
    const createRes = await fetch(`${baseUrl}/documents`, {
      method: "POST",
      headers: { cookie: `session_token=${encodeURIComponent(token)}` },
    })
    expect(createRes.status).toBe(200)
    const meta = await createRes.json()
    expect(meta).toHaveProperty("id")

    // Verify owner_id in DB
    const row = await db.query<{ owner_id: string }>(
      `SELECT owner_id FROM document WHERE id = $1 LIMIT 1`,
      [meta.id]
    )
    expect(row.rows[0]?.owner_id).toBeDefined()

    // Cleanup created document (and workspace cascade)
    await db.query(`DELETE FROM document WHERE id = $1`, [meta.id])
  })
})

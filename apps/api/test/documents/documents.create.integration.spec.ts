import { Test } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { AppModule } from "@api/app.module"
import { PrismaService } from "@api/database/prisma.module"
import type { PrismaClient } from "@api/generated/prisma/client"

describe("documents create (integration)", () => {
  let app: INestApplication
  let prisma: PrismaClient
  let baseUrl: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.listen(0)
    const address = app.getHttpServer().address()
    if (address === null || typeof address === "string")
      throw new Error("Expected TCP address")
    baseUrl = `http://127.0.0.1:${address.port}`
    prisma = app.get(PrismaService).client
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
    expect(registerRes.status).toBe(201)

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
    const authHeaders = { cookie: `session_token=${encodeURIComponent(token)}` }

    const workspacesRes = await fetch(`${baseUrl}/workspaces`, {
      headers: authHeaders,
    })
    expect(workspacesRes.status).toBe(200)
    const workspaces = await workspacesRes.json()
    expect(workspaces).toHaveLength(1)
    expect(workspaces[0]?.name).toBe("我的知识库")

    const listRes = await fetch(`${baseUrl}/documents`, {
      headers: authHeaders,
    })
    expect(listRes.status).toBe(200)
    const listed = await listRes.json()
    expect(listed.length).toBeGreaterThanOrEqual(1)

    // Create document using cookie header so server will recognize session
    const createRes = await fetch(`${baseUrl}/documents`, {
      method: "POST",
      headers: authHeaders,
    })
    expect(createRes.status).toBe(201)
    const meta = await createRes.json()
    expect(meta).toHaveProperty("id")

    // Verify owner_id was populated — documents.create assigns the
    // authenticated user as owner when creating the first document.
    const doc = await prisma.document.findFirst({
      where: { id: meta.id },
      select: { ownerId: true },
    })
    expect(doc?.ownerId).toBeDefined()

    // Cleanup: delete the created document (workspace cascades via FK).
    await prisma.document.delete({ where: { id: meta.id } })
  })
})

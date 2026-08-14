import { ForbiddenException, type INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { AppModule } from "../app.module"
import { DEV_USER_HEADER } from "../auth/dev-user"
import { PrismaService } from "../database/prisma.module"
import type { PrismaClient } from "../generated/prisma/client"
import { DocumentsService } from "./documents.service"

const USERS = {
  owner: "integration-owner",
  editor: "integration-editor",
  viewer: "integration-viewer",
  outsider: "integration-outsider",
} as const

describe("document authorization (integration)", () => {
  let app: INestApplication
  let prisma: PrismaClient
  let documents: DocumentsService
  let baseUrl: string
  let workspaceId: string
  let documentId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.listen(0)
    const address = app.getHttpServer().address()
    if (address === null || typeof address === "string") {
      throw new Error("Expected TCP listen address for integration app")
    }
    baseUrl = `http://127.0.0.1:${address.port}`

    prisma = app.get(PrismaService).client
    documents = app.get(DocumentsService)

    workspaceId = randomUUID()
    documentId = randomUUID()

    await prisma.workspace.create({
      data: { id: workspaceId, name: "Integration Auth Workspace" },
    })
    await prisma.document.create({
      data: {
        id: documentId,
        workspaceId,
        title: "Integration Auth Document",
      },
    })

    const members: Array<[string, string]> = [
      [USERS.owner, "owner"],
      [USERS.editor, "editor"],
      [USERS.viewer, "viewer"],
    ]
    for (const [userId, role] of members) {
      await prisma.documentMember.create({
        data: { documentId, userId, role },
      })
    }
  })

  afterAll(async () => {
    try {
      if (prisma && workspaceId) {
        await prisma.workspace.delete({ where: { id: workspaceId } })
      }
    } finally {
      await app?.close()
    }
  })

  async function getDocumentHttp(userId: string): Promise<Response> {
    return fetch(`${baseUrl}/documents/${documentId}`, {
      headers: { [DEV_USER_HEADER]: userId },
    })
  }

  it("rejects non-members on GET with 403", async () => {
    await expect(
      documents.getDocument(documentId, USERS.outsider)
    ).rejects.toBeInstanceOf(ForbiddenException)

    const response = await getDocumentHttp(USERS.outsider)
    expect(response.status).toBe(403)
  })

  it("allows viewer to read and rejects write with 403", async () => {
    await expect(
      documents.assertCanRead(documentId, USERS.viewer)
    ).resolves.toBe("viewer")

    const metadata = await documents.getDocument(documentId, USERS.viewer)
    expect(metadata).toMatchObject({
      id: documentId,
      workspaceId,
      title: "Integration Auth Document",
      role: "viewer",
    })

    const response = await getDocumentHttp(USERS.viewer)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: documentId,
      role: "viewer",
    })

    await expect(
      documents.assertCanWrite(documentId, USERS.viewer)
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("allows owner and editor to read and write", async () => {
    for (const [userId, role] of [
      [USERS.owner, "owner"],
      [USERS.editor, "editor"],
    ] as const) {
      await expect(documents.assertCanRead(documentId, userId)).resolves.toBe(
        role
      )
      await expect(documents.assertCanWrite(documentId, userId)).resolves.toBe(
        role
      )

      const metadata = await documents.getDocument(documentId, userId)
      expect(metadata.role).toBe(role)

      const response = await getDocumentHttp(userId)
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        id: documentId,
        role,
      })
    }
  })
})

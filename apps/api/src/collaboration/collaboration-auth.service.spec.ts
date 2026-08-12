import { ForbiddenException, UnauthorizedException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { DocumentsService } from "../documents/documents.service"
import { CollaborationAuthService } from "./collaboration-auth.service"

function createDocuments(
  overrides: Partial<DocumentsService> = {}
): DocumentsService {
  return {
    assertCanRead: vi.fn(),
    assertCanWrite: vi.fn(),
    getMemberRole: vi.fn(),
    getDocument: vi.fn(),
    ...overrides,
  } as unknown as DocumentsService
}

describe("CollaborationAuthService", () => {
  it("uses token as development identity when present", async () => {
    const documents = createDocuments({
      assertCanRead: vi.fn().mockResolvedValue("editor"),
    })
    const auth = new CollaborationAuthService(
      documents,
      // Provide a minimal mock AuthService for the constructor; tests that
      // exercise session-cookie paths will stub this further if needed.
      { findUserBySessionToken: vi.fn().mockResolvedValue(null) } as any
    )

    await expect(
      auth.authenticateConnection({
        documentId: "doc-1",
        token: "user-1",
        requestHeaders: {},
      })
    ).resolves.toEqual({
      userId: "user-1",
      role: "editor",
      readOnly: false,
    })
    expect(documents.assertCanRead).toHaveBeenCalledWith("doc-1", "user-1")
  })

  it("falls back to x-dev-user-id header when token is empty", async () => {
    const documents = createDocuments({
      assertCanRead: vi.fn().mockResolvedValue("viewer"),
    })
    const auth = new CollaborationAuthService(
      documents,
      { findUserBySessionToken: vi.fn().mockResolvedValue(null) } as any
    )

    await expect(
      auth.authenticateConnection({
        documentId: "doc-1",
        token: "   ",
        requestHeaders: { "x-dev-user-id": "viewer-1" },
      })
    ).resolves.toEqual({
      userId: "viewer-1",
      role: "viewer",
      readOnly: true,
    })
  })

  it("rejects missing identity with unauthorized", async () => {
    const auth = new CollaborationAuthService(
      createDocuments(),
      { findUserBySessionToken: vi.fn().mockResolvedValue(null) } as any
    )

    await expect(
      auth.authenticateConnection({
        documentId: "doc-1",
        token: "",
        requestHeaders: {},
      })
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("propagates non-member forbidden errors", async () => {
    const documents = createDocuments({
      assertCanRead: vi
        .fn()
        .mockRejectedValue(new ForbiddenException("Not a document member")),
    })
    const auth = new CollaborationAuthService(
      documents,
      { findUserBySessionToken: vi.fn().mockResolvedValue(null) } as any
    )

    await expect(
      auth.authenticateConnection({
        documentId: "doc-1",
        token: "outsider",
        requestHeaders: {},
      })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})

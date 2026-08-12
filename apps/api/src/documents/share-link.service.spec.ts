import { ForbiddenException, NotFoundException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { DocumentsService } from "./documents.service"
import type { ShareLinkRepository } from "./share-link.repository"
import { ShareLinkService } from "./share-link.service"

const activeLink = {
  token: "existing-token",
  document_id: "doc-1",
  created_by: "owner-1",
  created_at: new Date("2026-01-01"),
  revoked_at: null,
}

function createService(
  overrides: {
    assertCanWrite?: ReturnType<typeof vi.fn>
    findActiveByDocumentId?: ReturnType<typeof vi.fn>
    findActiveByToken?: ReturnType<typeof vi.fn>
    create?: ReturnType<typeof vi.fn>
    upsertMemberAsEditor?: ReturnType<typeof vi.fn>
  } = {}
) {
  const documents = {
    assertCanWrite:
      overrides.assertCanWrite ?? vi.fn().mockResolvedValue("owner"),
  } as unknown as DocumentsService
  const links = {
    findActiveByDocumentId:
      overrides.findActiveByDocumentId ?? vi.fn().mockResolvedValue(null),
    findActiveByToken:
      overrides.findActiveByToken ?? vi.fn().mockResolvedValue(activeLink),
    create: overrides.create ?? vi.fn().mockResolvedValue(activeLink),
    upsertMemberAsEditor:
      overrides.upsertMemberAsEditor ?? vi.fn().mockResolvedValue("editor"),
  } as unknown as ShareLinkRepository
  return { service: new ShareLinkService(documents, links), documents, links }
}

describe("ShareLinkService", () => {
  it("reuses an active link for an owner/editor", async () => {
    const findActiveByDocumentId = vi.fn().mockResolvedValue(activeLink)
    const { service, links } = createService({ findActiveByDocumentId })

    await expect(service.createOrGet("doc-1", "owner-1")).resolves.toEqual({
      token: "existing-token",
    })
    expect(links.create).not.toHaveBeenCalled()
  })

  it("rejects viewers from creating a link", async () => {
    const assertCanWrite = vi
      .fn()
      .mockRejectedValue(new ForbiddenException("Viewer cannot write"))
    const { service, links } = createService({ assertCanWrite })

    await expect(
      service.createOrGet("doc-1", "viewer-1")
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(links.findActiveByDocumentId).not.toHaveBeenCalled()
  })

  it("creates a random token when no active link exists", async () => {
    const create = vi.fn().mockImplementation(async (_doc, _user, token) => ({
      ...activeLink,
      token,
    }))
    const { service } = createService({ create })

    const result = await service.createOrGet("doc-1", "owner-1")
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(create).toHaveBeenCalledWith("doc-1", "owner-1", result.token)
  })

  it("accepts a valid token and upgrades/inserts editor membership", async () => {
    const upsertMemberAsEditor = vi.fn().mockResolvedValue("editor")
    const { service, links } = createService({ upsertMemberAsEditor })

    await expect(service.accept("existing-token", "viewer-1")).resolves.toEqual(
      {
        documentId: "doc-1",
        role: "editor",
      }
    )
    expect(links.findActiveByToken).toHaveBeenCalledWith("existing-token")
    expect(upsertMemberAsEditor).toHaveBeenCalledWith("doc-1", "viewer-1")
  })

  it("returns not found for an invalid token", async () => {
    const findActiveByToken = vi.fn().mockResolvedValue(null)
    const { service } = createService({ findActiveByToken })

    await expect(service.accept("missing", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    )
  })
})

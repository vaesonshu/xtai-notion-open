import { describe, expect, it, vi } from "vitest"
import type { DatabaseService } from "../database/database.service"
import { ShareLinkRepository } from "./share-link.repository"

function createDb(queryImpl?: DatabaseService["query"]): DatabaseService {
  return {
    query: queryImpl ?? vi.fn(),
    withTransaction: vi.fn(),
    onModuleDestroy: vi.fn(),
  } as unknown as DatabaseService
}

const row = {
  token: "token-1",
  document_id: "doc-1",
  created_by: "user-1",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  revoked_at: null,
}

describe("ShareLinkRepository", () => {
  it("finds the active link for a document", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] })
    const repo = new ShareLinkRepository(createDb(query))
    await expect(repo.findActiveByDocumentId("doc-1")).resolves.toEqual(row)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("revoked_at IS NULL"),
      ["doc-1"]
    )
  })

  it("finds an active link by token and returns null when absent", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })
    const repo = new ShareLinkRepository(createDb(query))
    await expect(repo.findActiveByToken("missing")).resolves.toBeNull()
    expect(query).toHaveBeenCalledWith(expect.stringContaining("token = $1"), [
      "missing",
    ])
  })

  it("creates a share link with parameterized values", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] })
    const repo = new ShareLinkRepository(createDb(query))
    await expect(repo.create("doc-1", "user-1", "token-1")).resolves.toEqual(
      row
    )
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO document_share_link"),
      ["token-1", "doc-1", "user-1"]
    )
  })
})

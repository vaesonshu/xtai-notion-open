import { describe, expect, it, vi } from "vitest"
import type { DatabaseService } from "../database/database.service"
import { DocumentsRepository } from "./documents.repository"

function createDb(
  queryImpl?: DatabaseService["query"]
): DatabaseService {
  return {
    query: queryImpl ?? vi.fn(),
    withTransaction: vi.fn(),
    onModuleDestroy: vi.fn(),
  } as unknown as DatabaseService
}

describe("DocumentsRepository", () => {
  it("getMemberRole returns role when membership exists", async () => {
    const db = createDb(
      vi.fn().mockResolvedValue({
        rows: [{ role: "editor" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      })
    )
    const repo = new DocumentsRepository(db)

    await expect(repo.getMemberRole("doc-1", "user-1")).resolves.toBe(
      "editor"
    )
    expect(db.query).toHaveBeenCalledWith(
      expect.stringMatching(/document_member/i),
      ["doc-1", "user-1"]
    )
  })

  it("getMemberRole returns null when user is not a member", async () => {
    const db = createDb(
      vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      })
    )
    const repo = new DocumentsRepository(db)

    await expect(repo.getMemberRole("doc-1", "stranger")).resolves.toBeNull()
  })

  it("findById returns document metadata row", async () => {
    const row = {
      id: "doc-1",
      workspace_id: "ws-1",
      title: "Demo",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
    }
    const db = createDb(
      vi.fn().mockResolvedValue({
        rows: [row],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      })
    )
    const repo = new DocumentsRepository(db)

    await expect(repo.findById("doc-1")).resolves.toEqual(row)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringMatching(/from\s+document/i),
      ["doc-1"]
    )
  })

  it("findById returns null when document is missing", async () => {
    const db = createDb(
      vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      })
    )
    const repo = new DocumentsRepository(db)

    await expect(repo.findById("missing")).resolves.toBeNull()
  })
})

import { describe, expect, it, vi } from "vitest"
import type { Pool, PoolClient, QueryResult } from "pg"
import { DatabaseService } from "./database.service"

function createMockPool(overrides: Partial<Pool> = {}): Pool {
  return {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    ...overrides,
  } as unknown as Pool
}

describe("DatabaseService", () => {
  it("query delegates to the pool with text and values", async () => {
    const expected: QueryResult<{ id: string }> = {
      rows: [{ id: "doc-1" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    }
    const pool = createMockPool({
      query: vi.fn().mockResolvedValue(expected),
    })
    const service = new DatabaseService(pool as Pool)

    const result = await service.query<{ id: string }>(
      "select id from document where id = $1",
      ["doc-1"]
    )

    expect(pool.query).toHaveBeenCalledWith(
      "select id from document where id = $1",
      ["doc-1"]
    )
    expect(result).toBe(expected)
  })

  it("withTransaction commits when the callback succeeds", async () => {
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: "BEGIN", oid: 0, fields: [] })
      .mockResolvedValueOnce({
        rows: [{ n: 1 }],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: "COMMIT", oid: 0, fields: [] })
    const client = {
      query: clientQuery,
      release: vi.fn(),
    } as unknown as PoolClient
    const pool = createMockPool({
      connect: vi.fn().mockResolvedValue(client),
    })
    const service = new DatabaseService(pool)

    const value = await service.withTransaction(async (tx) => {
      await tx.query(
        'insert into yjs_update (document_id, sequence, "update") values ($1, $2, $3)',
        [
          "doc-1",
          1,
          Buffer.from([1, 2, 3]),
        ]
      )
      return "ok"
    })

    expect(value).toBe("ok")
    expect(clientQuery.mock.calls[0]?.[0]).toBe("BEGIN")
    expect(clientQuery.mock.calls[1]?.[0]).toContain("insert into yjs_update")
    expect(clientQuery.mock.calls[2]?.[0]).toBe("COMMIT")
    expect(client.release).toHaveBeenCalledOnce()
  })

  it("withTransaction rolls back and rethrows when the callback fails", async () => {
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: "BEGIN", oid: 0, fields: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: "ROLLBACK", oid: 0, fields: [] })
    const client = {
      query: clientQuery,
      release: vi.fn(),
    } as unknown as PoolClient
    const pool = createMockPool({
      connect: vi.fn().mockResolvedValue(client),
    })
    const service = new DatabaseService(pool)
    const failure = new Error("write failed")

    await expect(
      service.withTransaction(async () => {
        throw failure
      })
    ).rejects.toBe(failure)

    expect(clientQuery.mock.calls[0]?.[0]).toBe("BEGIN")
    expect(clientQuery.mock.calls[1]?.[0]).toBe("ROLLBACK")
    expect(client.release).toHaveBeenCalledOnce()
  })
})

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const here = dirname(fileURLToPath(import.meta.url))
const apiRoot = join(here, "../..")
const repoRoot = join(apiRoot, "../..")

function readMigrationSql(): string {
  return readFileSync(
    join(apiRoot, "prisma/migrations/012_knowledge_library/migration.sql"),
    "utf8"
  )
}

// 从约束名后截取 ON DELETE，用来锁住级联/置空而不是只搜子串。
function foreignKeyOnDelete(
  sql: string,
  constraintName: string
): string | null {
  const start = sql.indexOf(constraintName)
  if (start < 0) {
    return null
  }
  const match = sql
    .slice(start, start + 400)
    .match(/ON DELETE (SET NULL|CASCADE|RESTRICT|NO ACTION|SET DEFAULT)/i)
  return match ? match[1].toUpperCase() : null
}

describe("knowledge library migration", () => {
  // 只校验迁移与镜像文本，避免本任务去连真实数据库。
  it("creates pgvector tables and the snapshot unique index", () => {
    const sql = readMigrationSql()

    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS vector")
    expect(sql).toContain("knowledge_library")
    expect(sql).toContain("knowledge_library_member")
    expect(sql).toContain("knowledge_source")
    expect(sql).toContain("knowledge_chunk")
    expect(sql).toContain("vector(1536)")
    expect(sql).toContain("CREATE UNIQUE INDEX")
    expect(sql).toContain("document_snapshot")
    expect(sql).toContain("source_document_id")
  })

  it("locks unique index, delete actions, and forbids hnsw", () => {
    const sql = readMigrationSql()
    const collapsed = sql.replace(/\s+/g, " ")

    expect(collapsed).toContain(
      "CREATE UNIQUE INDEX knowledge_source_library_document_uidx ON knowledge_source (library_id, source_document_id) WHERE kind = 'document_snapshot' AND source_document_id IS NOT NULL"
    )

    expect(foreignKeyOnDelete(sql, "knowledge_library_created_by_fkey")).toBe(
      "SET NULL"
    )
    expect(foreignKeyOnDelete(sql, "knowledge_source_created_by_fkey")).toBe(
      "SET NULL"
    )
    expect(
      foreignKeyOnDelete(sql, "knowledge_library_member_library_id_fkey")
    ).toBe("CASCADE")
    expect(foreignKeyOnDelete(sql, "knowledge_source_library_id_fkey")).toBe(
      "CASCADE"
    )
    expect(foreignKeyOnDelete(sql, "knowledge_chunk_source_id_fkey")).toBe(
      "CASCADE"
    )

    expect(sql).not.toMatch(/hnsw/i)
  })

  it("uses the pgvector Postgres 16 image locally", () => {
    const compose = readFileSync(join(repoRoot, "docker-compose.yml"), "utf8")

    expect(compose).toMatch(/image:\s*pgvector\/pgvector:pg16/)
  })
})

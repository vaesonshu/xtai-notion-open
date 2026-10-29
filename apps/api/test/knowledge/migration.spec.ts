import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const here = dirname(fileURLToPath(import.meta.url))
const apiRoot = join(here, "../..")
const repoRoot = join(apiRoot, "../..")

describe("knowledge library migration", () => {
  // 只校验迁移与镜像文本，避免本任务去连真实数据库。
  it("creates pgvector tables and the snapshot unique index", () => {
    const sql = readFileSync(
      join(apiRoot, "prisma/migrations/012_knowledge_library/migration.sql"),
      "utf8"
    )

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

  it("uses the pgvector Postgres 16 image locally", () => {
    const compose = readFileSync(join(repoRoot, "docker-compose.yml"), "utf8")

    expect(compose).toMatch(/image:\s*pgvector\/pgvector:pg16/)
  })
})

import { describe, expect, it } from "vitest"
import {
  CITATION_EXCERPT_CHARS,
  RETRIEVAL_MAX_CONTEXT_CHARS,
  buildKnowledgePrompt,
  selectKnowledgeHits,
} from "@api/knowledge/knowledge-retrieval"
import { FIND_NEAREST_CHUNKS_SQL } from "@api/knowledge/knowledge-source.repository"

const LIBRARY_ID = "lib-1"

type HitRow = Parameters<typeof selectKnowledgeHits>[0][number]

function hitRow(overrides: Partial<HitRow> = {}): HitRow {
  return {
    distance: 0.1,
    libraryId: LIBRARY_ID,
    generation: 1,
    activeGeneration: 1,
    embeddingRevision: 1,
    libraryRevision: 1,
    content: "产品定价说明",
    sourceId: "src-1",
    sourceTitle: "定价手册",
    heading: null,
    page: null,
    ...overrides,
  }
}

describe("FIND_NEAREST_CHUNKS_SQL", () => {
  it("filters current generation and ranks by cosine distance", () => {
    expect(FIND_NEAREST_CHUNKS_SQL).toContain("library_id = $1")
    expect(FIND_NEAREST_CHUNKS_SQL).toContain("generation = active_generation")
    expect(FIND_NEAREST_CHUNKS_SQL).toContain("active_generation > 0")
    expect(FIND_NEAREST_CHUNKS_SQL).toContain("embedding_revision = $2")
    expect(FIND_NEAREST_CHUNKS_SQL).toContain("ORDER BY embedding <=> $3")
    expect(FIND_NEAREST_CHUNKS_SQL).toContain("LIMIT 6")
  })
})

describe("selectKnowledgeHits", () => {
  it("keeps distance 0.8 and drops distance 0.8001", () => {
    const hits = selectKnowledgeHits(
      [
        hitRow({
          sourceId: "keep-src",
          distance: 0.8,
          content: "刚好过线",
        }),
        hitRow({
          sourceId: "drop-src",
          distance: 0.8001,
          content: "差一点点",
        }),
      ],
      LIBRARY_ID
    )

    expect(hits.map((hit) => hit.sourceId)).toEqual(["keep-src"])
    expect(hits[0]?.index).toBe(1)
    expect(hits[0]?.similarity).toBeCloseTo(0.2)
  })

  it("drops other library, stale generation, and stale revision rows", () => {
    const hits = selectKnowledgeHits(
      [
        hitRow({ sourceId: "keep-src", content: "当前代" }),
        hitRow({
          sourceId: "other-lib",
          libraryId: "lib-other",
          content: "别的库",
        }),
        hitRow({
          sourceId: "old-gen",
          generation: 1,
          activeGeneration: 2,
          content: "旧代",
        }),
        hitRow({
          sourceId: "never-indexed",
          generation: 0,
          activeGeneration: 0,
          content: "尚未索引",
        }),
        hitRow({
          sourceId: "old-rev",
          embeddingRevision: 1,
          libraryRevision: 2,
          content: "旧向量版本",
        }),
      ],
      LIBRARY_ID
    )

    expect(hits.map((hit) => hit.sourceId)).toEqual(["keep-src"])
  })

  it("keeps at most 6 nearest rows even when more are similar", () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      hitRow({
        sourceId: `src-${index + 1}`,
        distance: 0.1 + index * 0.01,
        content: `块${index + 1}`,
      })
    )

    const hits = selectKnowledgeHits(rows, LIBRARY_ID)

    expect(hits).toHaveLength(6)
    expect(hits.map((hit) => hit.sourceId)).toEqual([
      "src-1",
      "src-2",
      "src-3",
      "src-4",
      "src-5",
      "src-6",
    ])
    expect(hits.map((hit) => hit.index)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("truncates excerpts longer than 500 characters", () => {
    const content = "摘".repeat(CITATION_EXCERPT_CHARS + 40)
    const hits = selectKnowledgeHits(
      [hitRow({ content, sourceId: "long-src" })],
      LIBRARY_ID
    )

    expect(hits[0]?.excerpt).toHaveLength(CITATION_EXCERPT_CHARS)
    expect(hits[0]?.excerpt).toBe(content.slice(0, CITATION_EXCERPT_CHARS))
  })
})

describe("buildKnowledgePrompt", () => {
  it("uses 第 N 页 when a citation has page 3 and no heading", () => {
    const hits = selectKnowledgeHits(
      [
        hitRow({
          sourceId: "page-src",
          sourceTitle: "手册",
          heading: null,
          page: 3,
          content: "第三页正文",
        }),
      ],
      LIBRARY_ID
    )

    expect(buildKnowledgePrompt(hits)).toContain("第 3 页")
    expect(buildKnowledgePrompt(hits)).toContain("[1]")
  })

  it("keeps heading 概述 in the prompt", () => {
    const hits = selectKnowledgeHits(
      [
        hitRow({
          sourceId: "heading-src",
          sourceTitle: "手册",
          heading: "概述",
          page: null,
          // 摘录不含「概述」，避免定位行漏标题时仍靠正文混过断言。
          content: "产品范围与适用条款",
        }),
      ],
      LIBRARY_ID
    )

    expect(buildKnowledgePrompt(hits)).toContain("（概述）")
  })

  it("caps the assembled prompt at 12000 characters", () => {
    const hits = selectKnowledgeHits(
      Array.from({ length: 6 }, (_, index) =>
        hitRow({
          sourceId: `src-${index + 1}`,
          content: "长".repeat(CITATION_EXCERPT_CHARS),
          distance: 0.1 + index * 0.01,
        })
      ),
      LIBRARY_ID
    )
    const padded = hits.map((hit) => ({
      ...hit,
      excerpt: "超".repeat(RETRIEVAL_MAX_CONTEXT_CHARS),
    }))

    expect(buildKnowledgePrompt(padded).length).toBeLessThanOrEqual(
      RETRIEVAL_MAX_CONTEXT_CHARS
    )
  })
})

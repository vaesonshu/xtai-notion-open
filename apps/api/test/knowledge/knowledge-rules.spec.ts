import { describe, expect, it } from "vitest"
import {
  applyEmbeddingPatch,
  DEFAULT_EMBEDDING_BASE_URL,
  roleAtLeast,
  sourceStatusLabel,
} from "@api/knowledge/knowledge.types"

describe("roleAtLeast", () => {
  it("treats viewer as below editor", () => {
    expect(roleAtLeast("viewer", "editor")).toBe(false)
  })

  it("treats editor as at least viewer", () => {
    expect(roleAtLeast("editor", "viewer")).toBe(true)
  })
})

describe("sourceStatusLabel", () => {
  it("labels first-time queued ingest as 索引中", () => {
    expect(sourceStatusLabel("queued", 0)).toBe("索引中")
  })

  it("labels later processing as 更新中", () => {
    expect(sourceStatusLabel("processing", 2)).toBe("更新中")
  })

  it("labels later failed ingest as 更新失败，仍可问答", () => {
    expect(sourceStatusLabel("failed", 2)).toBe("更新失败，仍可问答")
  })

  it("labels first-time failed ingest as 索引失败", () => {
    expect(sourceStatusLabel("failed", 0)).toBe("索引失败")
  })

  it("labels ready as 就绪", () => {
    expect(sourceStatusLabel("ready", 0)).toBe("就绪")
  })
})

describe("applyEmbeddingPatch", () => {
  it("writes a new api key without bumping revision", () => {
    const result = applyEmbeddingPatch(
      {
        settings: {
          openAiApiKey: "sk-old",
          openAiEmbeddingModel: "text-embedding-3-small",
        },
        revision: 3,
      },
      { openAiApiKey: "sk-new" }
    )

    expect(result.revision).toBe(3)
    expect(result.modelChanged).toBe(false)
    expect(result.settings.openAiApiKey).toBe("sk-new")
    expect(result.settings.openAiEmbeddingModel).toBe("text-embedding-3-small")
  })

  it("bumps revision when the embedding model name changes", () => {
    const result = applyEmbeddingPatch(
      {
        settings: { openAiEmbeddingModel: "text-embedding-3-small" },
        revision: 1,
      },
      { openAiEmbeddingModel: "text-embedding-3-large" }
    )

    expect(result.revision).toBe(2)
    expect(result.modelChanged).toBe(true)
    expect(result.settings.openAiEmbeddingModel).toBe("text-embedding-3-large")
  })

  it("bumps revision when the embedding base url changes", () => {
    const result = applyEmbeddingPatch(
      {
        settings: { openAiBaseUrl: DEFAULT_EMBEDDING_BASE_URL },
        revision: 4,
      },
      { openAiBaseUrl: "https://example.com/v1" }
    )

    expect(result.revision).toBe(5)
    expect(result.modelChanged).toBe(true)
    expect(result.settings.openAiBaseUrl).toBe("https://example.com/v1")
  })

  it("keeps the current api key when the patch key is empty", () => {
    const result = applyEmbeddingPatch(
      { settings: { openAiApiKey: "sk-keep" }, revision: 2 },
      { openAiApiKey: "" }
    )

    expect(result.settings.openAiApiKey).toBe("sk-keep")
    expect(result.revision).toBe(2)
    expect(result.modelChanged).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import {
  prepareKnowledgeChunks,
  splitKnowledgeChunks,
} from "@api/knowledge/chunker"
import { hashKnowledgeBody } from "@api/knowledge/content-hash"
import { KnowledgeChunkError } from "@api/knowledge/knowledge.types"

describe("knowledge chunker", () => {
  it("overlaps the next hard-cut chunk by the last 120 chars", () => {
    const chunks = splitKnowledgeChunks("a".repeat(1480))
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[1]?.content.startsWith(chunks[0]!.content.slice(-120))).toBe(
      true
    )
  })

  it("joins nested markdown headings with a slash path", () => {
    const chunks = splitKnowledgeChunks("# 概述\n\n段落一\n\n## 安装\n\n段落二")
    const second = chunks.find((chunk) => chunk.content.includes("段落二"))
    expect(second?.heading).toBe("概述 / 安装")
  })

  it("rejects whitespace-only bodies as empty", () => {
    expect(() => prepareKnowledgeChunks({ text: "   \n\t  " })).toThrow(
      new KnowledgeChunkError("empty")
    )
  })

  it("rejects bodies longer than 270000 chars", () => {
    expect(() => prepareKnowledgeChunks({ text: "a".repeat(270001) })).toThrow(
      new KnowledgeChunkError("too_long")
    )
  })

  it("rejects splits that exceed maxChunks", () => {
    expect(() =>
      splitKnowledgeChunks("a".repeat(900), { maxChunks: 1, page: null })
    ).toThrow(new KnowledgeChunkError("too_many_chunks"))
  })

  it("chunks provided pages and keeps the page number", () => {
    const chunks = prepareKnowledgeChunks({
      text: "",
      pages: [{ page: 2, text: "甲" }],
    })
    expect(chunks[0]?.page).toBe(2)
  })
})

describe("knowledge body hash", () => {
  // CRLF 规范化后再 trim，避免同一正文因换行符不同而换哈希。
  it("normalizes CRLF and trim before hashing", () => {
    expect(hashKnowledgeBody(" a\r\nb ")).toBe(hashKnowledgeBody("a\nb"))
  })
})

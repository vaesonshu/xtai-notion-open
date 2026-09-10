import { describe, expect, it } from "vitest"
import {
  extractMarkdownTitle,
  getAgentUnavailableMessage,
  isAgentAvailable,
} from "@/lib/article-agent"

describe("article agent helpers", () => {
  it("extracts title from markdown heading", () => {
    expect(extractMarkdownTitle("# 产品复盘\n\n正文")).toBe("产品复盘")
  })

  it("falls back when markdown has no heading", () => {
    expect(extractMarkdownTitle("plain text", "默认标题")).toBe("默认标题")
  })

  it("treats only local_codex mode as agent available", () => {
    expect(isAgentAvailable("local_codex")).toBe(true)
    expect(isAgentAvailable("cloud")).toBe(false)
    expect(isAgentAvailable("unavailable")).toBe(false)
  })

  it("returns guidance when cloud ai is configured", () => {
    expect(getAgentUnavailableMessage("cloud", "cloud")).toContain("本地 Codex")
  })

  it("returns bridge hint when local codex is offline", () => {
    expect(getAgentUnavailableMessage("unavailable", "local_codex")).toContain(
      "Codex Bridge"
    )
  })
})

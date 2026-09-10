import { afterEach, describe, expect, it } from "vitest"
import {
  DOCUMENT_AGENT_DESKTOP_ONLY_MESSAGE,
  extractMarkdownTitle,
  getAgentUnavailableMessage,
  isAgentAvailable,
} from "@/lib/article-agent"

afterEach(() => {
  delete window.electronDesktop
})

describe("article agent helpers", () => {
  it("extracts title from markdown heading", () => {
    expect(extractMarkdownTitle("# 产品复盘\n\n正文")).toBe("产品复盘")
  })

  it("falls back when markdown has no heading", () => {
    expect(extractMarkdownTitle("plain text", "默认标题")).toBe("默认标题")
  })

  it("treats only desktop local_codex mode as agent available", () => {
    expect(isAgentAvailable("local_codex")).toBe(false)
    window.electronDesktop = {
      isDesktop: true,
      notify: async () => true,
      retryLoad: async () => undefined,
    }
    expect(isAgentAvailable("local_codex")).toBe(true)
    expect(isAgentAvailable("cloud")).toBe(false)
    expect(isAgentAvailable("unavailable")).toBe(false)
  })

  it("explains desktop-only access on the web", () => {
    expect(getAgentUnavailableMessage("local_codex", "local_codex")).toBe(
      DOCUMENT_AGENT_DESKTOP_ONLY_MESSAGE
    )
  })

  it("returns guidance when cloud ai is configured", () => {
    window.electronDesktop = {
      isDesktop: true,
      notify: async () => true,
      retryLoad: async () => undefined,
    }
    expect(getAgentUnavailableMessage("cloud", "cloud")).toContain("本地 Codex")
  })

  it("returns bridge hint when local codex is offline", () => {
    window.electronDesktop = {
      isDesktop: true,
      notify: async () => true,
      retryLoad: async () => undefined,
    }
    expect(getAgentUnavailableMessage("unavailable", "local_codex")).toContain(
      "Codex Bridge"
    )
  })
})

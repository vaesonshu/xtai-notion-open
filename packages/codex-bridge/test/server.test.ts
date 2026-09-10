import { describe, expect, it } from "vitest"
import { createBridgeServer } from "../src/server.js"
import type { ArticleStreamEvent } from "../src/types.js"

describe("bridge server", () => {
  it("returns health and streams article events from injected runner", async () => {
    const server = createBridgeServer({
      configLoader: async () => ({
        port: 3847,
        workspaces: {
          "ws-1": { localRoot: "D:/notes" },
        },
      }),
      runner: {
        async *streamArticle() {
          yield { type: "token", content: "# Hello" } satisfies ArticleStreamEvent
          yield { type: "done" } satisfies ArticleStreamEvent
        },
      },
    })

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve)
    })
    const address = server.address()
    const port =
      address && typeof address === "object" ? address.port : 0

    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`)
      expect(health.ok).toBe(true)
      const body = (await health.json()) as { ok: boolean }
      expect(body.ok).toBe(true)

      const response = await fetch(`http://127.0.0.1:${port}/article/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws-1",
          prompt: "写一篇测试文章",
        }),
      })
      expect(response.ok).toBe(true)
      const text = await response.text()
      expect(text).toContain('"type":"token"')
      expect(text).toContain("# Hello")
    } finally {
      server.close()
    }
  })

  it("streams article without a configured local root", async () => {
    const server = createBridgeServer({
      configLoader: async () => ({ port: 3847, workspaces: {} }),
      runner: {
        async *streamArticle(input) {
          expect(input.localRoot).toBeUndefined()
          yield { type: "token", content: "ok" } satisfies ArticleStreamEvent
          yield { type: "done" } satisfies ArticleStreamEvent
        },
      },
    })

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve)
    })
    const address = server.address()
    const port =
      address && typeof address === "object" ? address.port : 0

    try {
      const response = await fetch(`http://127.0.0.1:${port}/article/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws-new",
          prompt: "续写一段结论",
          documentText: "前文内容",
        }),
      })
      expect(response.ok).toBe(true)
      const text = await response.text()
      expect(text).toContain('"type":"done"')
    } finally {
      server.close()
    }
  })
})

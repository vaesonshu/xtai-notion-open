import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { URL } from "node:url"
import {
  DEFAULT_BRIDGE_PORT,
  loadBridgeConfig,
  upsertWorkspaceMapping,
  type BridgeConfig,
} from "./config.js"
import { createCodexRunner, type CodexRunner } from "./codex-runner.js"
import type { ArticleRunRequest, ArticleStreamEvent } from "./types.js"

const CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "content-type")
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) return {} as T
  return JSON.parse(raw) as T
}

function writeJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body))
}

function writeSse(res: ServerResponse) {
  res.statusCode = 200
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
}

async function streamArticleSse(
  res: ServerResponse,
  events: AsyncIterable<ArticleStreamEvent>
) {
  writeSse(res)
  try {
    for await (const event of events) {
      if (res.writableEnded) break
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    }
  } finally {
    if (!res.writableEnded) res.end()
  }
}

export function createBridgeServer(options?: {
  runner?: CodexRunner
  configLoader?: () => Promise<BridgeConfig>
}) {
  const runner = options?.runner ?? createCodexRunner()
  const configLoader = options?.configLoader ?? loadBridgeConfig

  return createServer(async (req, res) => {
    applyCors(req, res)
    if (req.method === "OPTIONS") {
      res.statusCode = 204
      res.end()
      return
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const config = await configLoader()

    if (req.method === "GET" && url.pathname === "/health") {
      writeJson(res, 200, {
        ok: true,
        workspaceCount: Object.keys(config.workspaces).length,
      })
      return
    }

    if (req.method === "GET" && url.pathname === "/config") {
      writeJson(res, 200, config)
      return
    }

    const workspaceMatch = url.pathname.match(/^\/workspaces\/([^/]+)$/)
    if (workspaceMatch && req.method === "PUT") {
      const workspaceId = decodeURIComponent(workspaceMatch[1]!)
      const body = await readJsonBody<{ localRoot?: string }>(req)
      if (body.localRoot === undefined) {
        writeJson(res, 400, { message: "localRoot 字段缺失" })
        return
      }
      const next = await upsertWorkspaceMapping(workspaceId, {
        localRoot: body.localRoot,
      })
      writeJson(res, 200, next.workspaces[workspaceId])
      return
    }

    if (req.method === "POST" && url.pathname === "/article/run") {
      const body = await readJsonBody<ArticleRunRequest>(req)
      if (!body.workspaceId?.trim() || !body.prompt?.trim()) {
        writeJson(res, 400, { message: "workspaceId 与 prompt 不能为空" })
        return
      }
      const mapping = config.workspaces[body.workspaceId]
      const controller = new AbortController()
      req.on("close", () => controller.abort())
      await streamArticleSse(
        res,
        runner.streamArticle(
          { ...body, localRoot: mapping?.localRoot },
          controller.signal
        )
      )
      return
    }

    writeJson(res, 404, { message: "Not found" })
  })
}

export async function startBridgeServer(port = DEFAULT_BRIDGE_PORT) {
  const server = createBridgeServer()
  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve)
  })
  return server
}

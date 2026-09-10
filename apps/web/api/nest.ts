type NestHandler = (req: unknown, res: unknown) => Promise<void>

type RequestLike = {
  url?: string
  headers?: Record<string, string | string[] | undefined>
}

type ResponseLike = {
  statusCode?: number
  setHeader?(name: string, value: string): void
  end?(chunk: string): void
}

let cached: NestHandler | null = null

function readRequestHeader(
  headers: RequestLike["headers"],
  name: string
): string | undefined {
  const value = headers?.[name]
  if (Array.isArray(value)) return value[0]
  return value
}

// 浏览器走同域 /auth/* 时，Vercel rewrite 不会自动加 Nest 的 globalPrefix。
function resolveAuthProxyPath(req: unknown): string | undefined {
  const request = req as RequestLike
  const directUrl = request.url
  if (typeof directUrl === "string") {
    const path = directUrl.split("?")[0]
    if (path.startsWith("/auth")) {
      return directUrl
    }
  }

  // Some Vercel rewrites replace req.url with /api/nest; recover the auth path.
  const forwarded =
    readRequestHeader(request.headers, "x-vercel-original-path") ??
    readRequestHeader(request.headers, "x-forwarded-uri") ??
    readRequestHeader(request.headers, "x-invoke-path")
  if (forwarded?.startsWith("/auth")) {
    return forwarded
  }
  return undefined
}

function withApiPrefixForAuthProxy(req: unknown): void {
  const request = req as RequestLike
  const authPath = resolveAuthProxyPath(req)
  if (authPath) {
    request.url = `/api${authPath.startsWith("/") ? authPath : `/${authPath}`}`
  }
}

// 字面量路径让 Vercel 的 nft 能打包 Nest 依赖；须先 `pnpm --filter api build`。
async function loadNestHandler(): Promise<NestHandler> {
  // @ts-expect-error — 从 api 的 tsc 产物加载，避免 next build 扫 Nest 源码
  const mod = (await import("../../api/dist/serverless.js")) as {
    default: NestHandler
  }
  return mod.default
}

// Vercel 只把 apps/web/api/ 下的文件当作 Serverless Function。
export default async function handler(
  req: unknown,
  res: unknown
): Promise<void> {
  try {
    if (!cached) {
      cached = await loadNestHandler()
    }
    withApiPrefixForAuthProxy(req)
    await cached(req, res)
  } catch (error) {
    const response = res as ResponseLike
    const message =
      error instanceof Error
        ? error.message
        : "Nest serverless bootstrap failed"
    console.error("[api/nest]", error)
    if (typeof response.statusCode === "number") {
      response.statusCode = 500
    }
    response.setHeader?.("content-type", "application/json")
    response.end?.(
      JSON.stringify({
        statusCode: 500,
        message,
        error: "Internal Server Error",
      })
    )
  }
}

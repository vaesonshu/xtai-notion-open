type NestHandler = (req: unknown, res: unknown) => Promise<void>

type RequestLike = { url?: string }

type ResponseLike = {
  statusCode?: number
  setHeader?(name: string, value: string): void
  end?(chunk: string): void
}

let cached: NestHandler | null = null

// 浏览器走同域 /auth/* 时，Vercel rewrite 不会自动加 Nest 的 globalPrefix。
function withApiPrefixForAuthProxy(req: unknown): void {
  const request = req as RequestLike
  const url = request.url
  if (typeof url === "string" && url.startsWith("/auth")) {
    request.url = `/api${url}`
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
      error instanceof Error ? error.message : "Nest serverless bootstrap failed"
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

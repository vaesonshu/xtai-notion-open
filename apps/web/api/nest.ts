type NestHandler = (req: unknown, res: unknown) => Promise<void>

type RequestLike = { url?: string }

let cached: NestHandler | null = null

// 浏览器走同域 /auth/* 时，Vercel rewrite 不会自动加 Nest 的 globalPrefix。
function withApiPrefixForAuthProxy(req: unknown): void {
  const request = req as RequestLike
  const url = request.url
  if (typeof url === "string" && url.startsWith("/auth")) {
    request.url = `/api${url}`
  }
}

// Vercel 只把 apps/web/api/ 下的文件当作 Serverless Function。
// 运行时动态加载 Nest，避免 next build 类型检查扫过整个 apps/api。
export default async function handler(
  req: unknown,
  res: unknown
): Promise<void> {
  if (!cached) {
    const entry = ["..", "..", "api", "src", "serverless.js"].join("/")
    const mod = (await import(entry)) as { default: NestHandler }
    cached = mod.default
  }
  withApiPrefixForAuthProxy(req)
  await cached(req, res)
}

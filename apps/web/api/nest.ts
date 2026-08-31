type NestHandler = (req: unknown, res: unknown) => Promise<void>

let cached: NestHandler | null = null

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
  await cached(req, res)
}

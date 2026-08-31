import "reflect-metadata"
import type { INestApplication } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { loadEnvironment } from "./config/environment"

// Vercel serverless entry for the REST HTTP API. The long-running real-time
// collaboration WebSocket server (CollaborationService) is intentionally not
// started here: see its `isServerless` guard which skips listen() when
// VERCEL=1 so app bootstrap never tries to bind a port that a serverless
// function cannot own.
//
// loadEnvironment() strictly requires PORT / COLLABORATION_PORT / NODE_ENV on
// a normal server; in a serverless lambda those ports are meaningless, so we
// provide benign fallbacks only when the variables are absent. Database access
// is handled entirely by PrismaModule, which only needs DATABASE_URL.
function applyServerlessDefaults(): void {
  process.env.NODE_ENV ??= "production"
  process.env.PORT ??= "1"
  process.env.COLLABORATION_PORT ??= "1"
}
applyServerlessDefaults()

let cachedApp: Promise<INestApplication> | null = null

// Reuse the initialized Nest application across warm serverless invocations so
// the relatively heavy app bootstrap (DI graph, Prisma client) is amortized
// instead of repeated per request (cold + warm).
async function getApp(): Promise<INestApplication> {
  if (!cachedApp) {
    void loadEnvironment()
    const app = await NestFactory.create(AppModule)
    app.enableCors({ origin: true, credentials: true })
    // 与 Web 同域部署时，Vercel 将 /api/* 转发到此 handler；加前缀避免与
    // Next.js 页面路由（如 /documents、/square）冲突。
    if (process.env.VERCEL) {
      app.setGlobalPrefix("api")
    }
    // app.init() (not listen) because Vercel routes HTTP onto this handler.
    cachedApp = app.init()
  }
  return cachedApp
}

// @vercel/node invokes this exported handler for every HTTP request.
// getHttpAdapter() 返回 ExpressAdapter 包装对象，不是 (req,res) 函数；需 getInstance()。
export default async function handler(
  req: unknown,
  res: unknown
): Promise<void> {
  const nestApp = await getApp()
  const expressApp = nestApp.getHttpAdapter().getInstance() as (
    req: unknown,
    res: unknown
  ) => void
  expressApp(req, res)
}

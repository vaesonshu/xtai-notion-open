import "reflect-metadata"
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { CollabAppModule } from "./collab-app.module"
import { loadEnvironment } from "./config/environment"

const logger = new Logger("CollabMain")

// Render 等平台只注入一个对外 PORT；该进程仅启动 Hocuspocus，不占用第二 HTTP 端口。
function applyCollaborationOnlyPortDefaults(): void {
  process.env.NODE_ENV ??= "production"
  // Hocuspocus 监听平台分配的 PORT（Render 部署时会自动注入）
  process.env.COLLABORATION_PORT ??= process.env.PORT ?? "3101"
  // loadEnvironment 仍校验 PORT，与协作端口对齐即可（本入口不会 app.listen）
  process.env.PORT ??= process.env.COLLABORATION_PORT
}

applyCollaborationOnlyPortDefaults()

async function bootstrap(): Promise<void> {
  const env = loadEnvironment()
  const app = await NestFactory.create(CollabAppModule, {
    logger: env.NODE_ENV === "production" ? ["error", "warn", "log"] : undefined,
  })
  // 只初始化 Nest DI 与 CollaborationService；REST 留在 Vercel，此处不绑定 HTTP。
  await app.init()
  logger.log(
    `Collaboration-only mode: WebSocket listening on port ${env.COLLABORATION_PORT}`
  )
}

void bootstrap()

import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from "@nestjs/common"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import ws from "ws"
import { PrismaClient } from "../generated/prisma/client"

export const PRISMA = Symbol("PRISMA")

// Node 20 无全局 WebSocket；Neon Pool 必须注入 ws 否则 flush 时会抛 ErrorEvent
neonConfig.webSocketConstructor = ws

// 本地 pg Pool 需在 disconnect 时 end；Neon adapter 无此资源。
let localPgPool: Pool | null = null

function resolveDatabaseDriver(connectionString: string): "postgres" | "neon" {
  const explicit = process.env.DATABASE_DRIVER?.trim().toLowerCase()
  if (explicit === "postgres" || explicit === "pg") {
    return "postgres"
  }
  if (explicit === "neon") {
    return "neon"
  }
  // 未显式指定时，localhost 走 TCP pg 驱动，其余默认 Neon serverless。
  if (/localhost|127\.0\.0\.1/i.test(connectionString)) {
    return "postgres"
  }
  return "neon"
}

function createPrismaClient(connectionString: string): PrismaClient {
  const driver = resolveDatabaseDriver(connectionString)

  if (driver === "postgres") {
    localPgPool = new Pool({ connectionString })
    const adapter = new PrismaPg(localPgPool)
    return new PrismaClient({ adapter })
  }

  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

// 业务层通过注入 PrismaService 获得类型化的 PrismaClient 单例。
@Injectable()
export class PrismaService {
  constructor(@Inject(PRISMA) public readonly client: PrismaClient) {}
}

// PrismaClient 是重量级且有状态的连接管理对象，必须以单例通过 DI 共享，
// 避免每个 repository 各自 new 导致连接泄漏。
@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: (): PrismaClient => {
        const connectionString = process.env.DATABASE_URL
        if (!connectionString) {
          throw new Error("Missing required environment variable: DATABASE_URL")
        }
        return createPrismaClient(connectionString)
      },
    },
    PrismaService,
  ],
  exports: [PRISMA, PrismaService],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  // 应用关闭时释放 Prisma 与本地 pg Pool，避免进程退出时挂起或泄漏。
  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect()
    if (localPgPool) {
      await localPgPool.end()
      localPgPool = null
    }
  }
}

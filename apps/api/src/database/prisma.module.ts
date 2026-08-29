import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from "@nestjs/common"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"
import { PrismaClient } from "../generated/prisma/client"

export const PRISMA = Symbol("PRISMA")

// Node 20 无全局 WebSocket；Neon Pool 必须注入 ws 否则 flush 时会抛 ErrorEvent
neonConfig.webSocketConstructor = ws

// 业务层通过注入 PrismaService 获得类型化的 PrismaClient 单例。
@Injectable()
export class PrismaService {
  constructor(@Inject(PRISMA) public readonly client: PrismaClient) {}
}

// PrismaClient 是重量级且有状态的连接管理对象，必须以单例通过 DI 共享，
// 避免每个 repository 各自 new 导致连接泄漏。Neon serverless adapter 走
// HTTP/WebSocket 驱动，天然适配 Vercel 的短暂、按需 serverless 函数：
// 它不会消耗 TCP 连接池，冷启动也能快速建立查询通道。
// 这里直接读取 process.env.DATABASE_URL（Neon 池化连接串），不依赖
// Environment 模块的其他必填变量，便于将来在 Vercel 环境中独立配置。
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
        const adapter = new PrismaNeon({ connectionString })
        return new PrismaClient({ adapter })
      },
    },
    PrismaService,
  ],
  exports: [PRISMA, PrismaService],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  // 应用关闭时释放 Prisma 持有的连接，避免进程退出时挂起或泄漏。
  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

import { Module } from "@nestjs/common"
import { AuthModule } from "./auth/auth.module"
import { CollaborationModule } from "./collaboration/collaboration.module"
import { ConfigModule } from "./config/config.module"
import { PrismaModule } from "./database/prisma.module"
import { DocumentsModule } from "./documents/documents.module"

// Render 协作进程只需 WebSocket + 鉴权 + Yjs 持久化，避免拉起完整 REST 栈。
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    DocumentsModule,
    CollaborationModule,
  ],
})
export class CollabAppModule {}

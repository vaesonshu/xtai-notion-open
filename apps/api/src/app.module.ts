import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { SessionInitGuard } from "./auth/session-init.guard"
import { AuthModule } from "./auth/auth.module"
import { CosModule } from "./storage/cos.module"
import { CollaborationModule } from "./collaboration/collaboration.module"
import { ConfigModule } from "./config/config.module"
import { PrismaModule } from "./database/prisma.module"
import { DocumentsModule } from "./documents/documents.module"
import { CommentsModule } from "./comments/comments.module"
import { HealthController } from "./health/health.controller"
import { ImageUploadModule } from "./images/image-upload.module"
import { AiModule } from "./ai/ai.module"

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    DocumentsModule,
    CommentsModule,
    CollaborationModule,
    CosModule,
    ImageUploadModule,
    AiModule,
  ],
  providers: [
    // Register SessionInitGuard globally so every request will attempt to
    // resolve a session cookie into request.user when present. This is a
    // non-enforcing guard (it only attaches the user) and lets controllers
    // continue to use CurrentUser without explicit per-route session parsing.
    { provide: APP_GUARD, useClass: SessionInitGuard },
  ],
  controllers: [HealthController],
})
export class AppModule {}

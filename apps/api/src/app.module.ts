import { Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { SessionInitGuard } from "./auth/session-init.guard"
import { AuthModule } from "./auth/auth.module"
import { CosModule } from "./storage/cos.module"
import { CollaborationModule } from "./collaboration/collaboration.module"
import { DatabaseModule } from "./database/database.module"
import { DocumentsModule } from "./documents/documents.module"
import { HealthController } from "./health/health.controller"
import { ImageUploadModule } from "./images/image-upload.module"

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DocumentsModule,
    CollaborationModule,
    CosModule,
    ImageUploadModule,
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

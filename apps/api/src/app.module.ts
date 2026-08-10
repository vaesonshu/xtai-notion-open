import { Module } from "@nestjs/common"
import { AuthModule } from "./auth/auth.module"
import { CollaborationModule } from "./collaboration/collaboration.module"
import { DatabaseModule } from "./database/database.module"
import { DocumentsModule } from "./documents/documents.module"
import { HealthController } from "./health/health.controller"

@Module({
  imports: [DatabaseModule, AuthModule, DocumentsModule, CollaborationModule],
  controllers: [HealthController],
})
export class AppModule {}

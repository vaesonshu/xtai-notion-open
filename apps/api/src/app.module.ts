import { Module } from "@nestjs/common"
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
  controllers: [HealthController],
})
export class AppModule {}

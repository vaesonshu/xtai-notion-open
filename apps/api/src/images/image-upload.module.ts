import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { DocumentsModule } from "../documents/documents.module"
import { CosModule } from "../storage/cos.module"
import { ImageUploadController } from "./image-upload.controller"
import { ImageUploadService } from "./image-upload.service"

@Module({
  // AuthenticatedIdentityGuard 依赖 AuthService，需引入 AuthModule
  imports: [AuthModule, DocumentsModule, CosModule],
  controllers: [ImageUploadController],
  providers: [ImageUploadService],
})
export class ImageUploadModule {}

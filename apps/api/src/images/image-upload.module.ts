import { Module } from "@nestjs/common"
import { DocumentsModule } from "../documents/documents.module"
import { CosModule } from "../storage/cos.module"
import { ImageUploadController } from "./image-upload.controller"
import { ImageUploadService } from "./image-upload.service"

@Module({
  imports: [DocumentsModule, CosModule],
  controllers: [ImageUploadController],
  providers: [ImageUploadService],
})
export class ImageUploadModule {}

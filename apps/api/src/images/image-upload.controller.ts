import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { DevelopmentIdentityGuard } from "../auth/development-identity.guard"
import type {
  PresignImageRequest,
  PresignImageResponse,
} from "./image-upload.types"
import { ImageUploadService } from "./image-upload.service"

@Controller("documents/:documentId/images")
@UseGuards(DevelopmentIdentityGuard)
export class ImageUploadController {
  constructor(
    @Inject(ImageUploadService) private readonly images: ImageUploadService
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } })
  )
  upload(
    @Param("documentId") documentId: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @CurrentUser() user: DevUser
  ): Promise<{ publicUrl: string; contentType: string }> {
    if (!file) throw new BadRequestException("Image file is required")
    return this.images.upload(documentId, user.id, file)
  }

  @Post("presign")
  createPresign(
    @Param("documentId") documentId: string,
    @Body() request: PresignImageRequest,
    @CurrentUser() user: DevUser
  ): Promise<PresignImageResponse> {
    return this.images.createPresign(documentId, user.id, request)
  }
}

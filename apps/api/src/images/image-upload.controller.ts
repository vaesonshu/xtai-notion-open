import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import type { Response } from "express"
import { FileInterceptor } from "@nestjs/platform-express"
import { CurrentUser } from "../auth/current-user.decorator"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type { DevUser } from "../auth/dev-user"
import type {
  PresignImageRequest,
  PresignImageResponse,
} from "./image-upload.types"
import { ImageUploadService } from "./image-upload.service"

@Controller("documents/:documentId/images")
@UseGuards(AuthenticatedIdentityGuard)
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

  @Get("proxy")
  async proxyImage(
    @Param("documentId") documentId: string,
    @Query("url") url: string | undefined,
    @CurrentUser() user: DevUser,
    @Res() response: Response
  ): Promise<void> {
    if (!url?.trim()) {
      throw new BadRequestException("Image url is required")
    }

    const result = await this.images.proxyImage(documentId, user.id, url)
    response.setHeader("Content-Type", result.contentType)
    response.setHeader("Cache-Control", "private, max-age=3600")
    response.send(result.buffer)
  }
}

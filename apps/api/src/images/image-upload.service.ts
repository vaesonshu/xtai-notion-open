import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { DocumentsService } from "../documents/documents.service"
import { CosService } from "../storage/cos.service"
import type {
  PresignImageRequest,
  PresignImageResponse,
} from "./image-upload.types"

type UploadedImage = {
  buffer: Buffer
  mimetype: string
  size: number
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const

function validateImageRequest(request: PresignImageRequest): string {
  const extension =
    IMAGE_EXTENSIONS[request.contentType as keyof typeof IMAGE_EXTENSIONS]
  if (!extension) {
    throw new BadRequestException("Unsupported image content type")
  }
  if (!Number.isFinite(request.size) || request.size < 0) {
    throw new BadRequestException(
      "Image size must be a non-negative finite number"
    )
  }
  if (request.size > MAX_IMAGE_SIZE) {
    throw new PayloadTooLargeException("Image must not exceed 10MB")
  }
  return extension
}

@Injectable()
export class ImageUploadService {
  constructor(
    @Inject(DocumentsService)
    private readonly documents: DocumentsService,
    @Inject(CosService)
    private readonly cos: CosService
  ) {}

  async createPresign(
    documentId: string,
    userId: string,
    request: PresignImageRequest
  ): Promise<PresignImageResponse> {
    await this.documents.assertCanWrite(documentId, userId)
    const extension = validateImageRequest(request)
    const objectKey = `documents/${documentId}/${randomUUID()}.${extension}`

    return this.cos.createPutPresign({
      objectKey,
      contentType: request.contentType,
    })
  }

  async proxyImage(
    documentId: string,
    userId: string,
    publicUrl: string
  ): Promise<{ buffer: Buffer; contentType: string }> {
    await this.documents.assertCanRead(documentId, userId)

    const objectKey = this.cos.resolveHostedImageObjectKey(publicUrl)
    if (!objectKey?.startsWith(`documents/${documentId}/`)) {
      throw new BadRequestException("Invalid image url")
    }

    const response = await fetch(publicUrl)
    if (!response.ok) {
      throw new BadRequestException("Image not found")
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream"

    return { buffer, contentType }
  }

  async upload(
    documentId: string,
    userId: string,
    file: UploadedImage
  ): Promise<{ publicUrl: string; contentType: string }> {
    await this.documents.assertCanWrite(documentId, userId)
    const extension = validateImageRequest({
      contentType: file.mimetype,
      size: file.size,
    })
    const objectKey = `documents/${documentId}/${randomUUID()}.${extension}`
    const result = await this.cos.putObject({
      objectKey,
      contentType: file.mimetype,
      body: file.buffer,
    })

    return { publicUrl: result.publicUrl, contentType: result.contentType }
  }
}

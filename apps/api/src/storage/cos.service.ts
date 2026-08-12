import { Injectable, Logger } from "@nestjs/common"
import COS from "cos-nodejs-sdk-v5"
import type {
  CosEnvironment,
  CosPutObjectInput,
  CosPutObjectResult,
  CosPresignResult,
  CosPutPresignInput,
} from "./cos.types"

type CosSigner = {
  getAuthorization: (options: {
    Method: "PUT"
    Key: string
    Headers: Record<string, string>
    Expires: number
  }) => string
}

type CosLogger = Pick<Logger, "error">

type CosUploader = {
  putObject: (options: {
    Bucket: string
    Region: string
    Key: string
    Body: Buffer
    ContentLength: number
    ContentType: string
  }) => Promise<unknown>
}

const PRESIGN_EXPIRES_SECONDS = 300

function requireValue(
  source: Partial<CosEnvironment>,
  key: keyof CosEnvironment
): string {
  const value = source[key]
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function joinUrl(baseUrl: string, objectKey: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${objectKey.replace(/^\/+/, "")}`
}

function cosObjectUrl(
  bucket: string,
  region: string,
  objectKey: string
): string {
  return `https://${bucket}.cos.${region}.myqcloud.com/${objectKey.replace(/^\/+/, "")}`
}

@Injectable()
export class CosService {
  private readonly logger: CosLogger
  private readonly source: Partial<CosEnvironment>
  private readonly signer: CosSigner
  private readonly uploader: CosUploader

  constructor(
    source: Partial<CosEnvironment>,
    signer?: CosSigner,
    logger: CosLogger = new Logger(CosService.name),
    uploader?: CosUploader
  ) {
    this.source = source
    this.logger = logger
    this.signer =
      signer ??
      ({
        getAuthorization: (options) =>
          COS.getAuthorization({
            SecretId: requireValue(this.source, "COS_SECRET_ID"),
            SecretKey: requireValue(this.source, "COS_SECRET_KEY"),
            Bucket: requireValue(this.source, "COS_BUCKET"),
            Region: requireValue(this.source, "COS_REGION"),
            Method: options.Method,
            Key: options.Key,
            Headers: options.Headers,
            Expires: options.Expires,
          }),
      } satisfies CosSigner)
    this.uploader =
      uploader ??
      ({
        putObject: (options) =>
          new COS({
            SecretId: requireValue(this.source, "COS_SECRET_ID"),
            SecretKey: requireValue(this.source, "COS_SECRET_KEY"),
          }).putObject(options),
      } satisfies CosUploader)
  }

  createPutPresign(input: CosPutPresignInput): CosPresignResult {
    const environment: CosEnvironment = {
      COS_SECRET_ID: requireValue(this.source, "COS_SECRET_ID"),
      COS_SECRET_KEY: requireValue(this.source, "COS_SECRET_KEY"),
      COS_BUCKET: requireValue(this.source, "COS_BUCKET"),
      COS_REGION: requireValue(this.source, "COS_REGION"),
    }
    const objectKey = input.objectKey.replace(/^\/+/, "")
    const contentType = input.contentType

    try {
      const authorization = this.signer.getAuthorization({
        Method: "PUT",
        Key: objectKey,
        Headers: { "Content-Type": contentType },
        Expires: PRESIGN_EXPIRES_SECONDS,
      })
      const uploadUrl = `${cosObjectUrl(
        environment.COS_BUCKET,
        environment.COS_REGION,
        objectKey
      )}?${authorization.replace(/^\?/, "")}`
      const publicBaseUrl =
        this.source.COS_PUBLIC_BASE_URL?.trim() ||
        cosObjectUrl(environment.COS_BUCKET, environment.COS_REGION, "")

      return {
        uploadUrl,
        publicUrl: joinUrl(publicBaseUrl, objectKey),
        objectKey,
        contentType,
      }
    } catch (error) {
      this.logger.error("COS presign failed")
      throw error
    }
  }

  async putObject(input: CosPutObjectInput): Promise<CosPutObjectResult> {
    const bucket = requireValue(this.source, "COS_BUCKET")
    const region = requireValue(this.source, "COS_REGION")
    const objectKey = input.objectKey.replace(/^\/+/, "")
    const publicBaseUrl =
      this.source.COS_PUBLIC_BASE_URL?.trim() ||
      cosObjectUrl(bucket, region, "")

    try {
      await this.uploader.putObject({
        Bucket: bucket,
        Region: region,
        Key: objectKey,
        Body: input.body,
        ContentLength: input.body.length,
        ContentType: input.contentType,
      })
      return {
        publicUrl: joinUrl(publicBaseUrl, objectKey),
        objectKey,
        contentType: input.contentType,
      }
    } catch (error) {
      this.logger.error("COS object upload failed")
      throw error
    }
  }
}

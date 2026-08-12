import { Injectable, Logger } from "@nestjs/common"
import COS from "cos-nodejs-sdk-v5"
import type {
  CosEnvironment,
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
  private readonly environment: CosEnvironment
  private readonly signer: CosSigner

  constructor(
    source: Partial<CosEnvironment>,
    signer?: CosSigner,
    logger: CosLogger = new Logger(CosService.name)
  ) {
    this.environment = {
      COS_SECRET_ID: requireValue(source, "COS_SECRET_ID"),
      COS_SECRET_KEY: requireValue(source, "COS_SECRET_KEY"),
      COS_BUCKET: requireValue(source, "COS_BUCKET"),
      COS_REGION: requireValue(source, "COS_REGION"),
      COS_PUBLIC_BASE_URL: requireValue(source, "COS_PUBLIC_BASE_URL"),
    }
    this.logger = logger
    this.signer =
      signer ??
      ({
        getAuthorization: (options) =>
          COS.getAuthorization({
            SecretId: this.environment.COS_SECRET_ID,
            SecretKey: this.environment.COS_SECRET_KEY,
            Bucket: this.environment.COS_BUCKET,
            Region: this.environment.COS_REGION,
            Method: options.Method,
            Key: options.Key,
            Headers: options.Headers,
            Expires: options.Expires,
          }),
      } satisfies CosSigner)
  }

  createPutPresign(input: CosPutPresignInput): CosPresignResult {
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
        this.environment.COS_BUCKET,
        this.environment.COS_REGION,
        objectKey
      )}?sign=${encodeURIComponent(authorization)}`

      return {
        uploadUrl,
        publicUrl: joinUrl(this.environment.COS_PUBLIC_BASE_URL, objectKey),
        objectKey,
        contentType,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      this.logger.error(`COS presign failed: ${message}`)
      throw error
    }
  }
}

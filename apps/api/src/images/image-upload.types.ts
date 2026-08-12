import type { CosPresignResult } from "../storage/cos.types"

export type PresignImageRequest = {
  contentType: string
  size: number
}

export type PresignImageResponse = CosPresignResult

export type CosPresignRequest = {
  objectKey: string
  contentType: string
}

export type CosPresignResult = {
  uploadUrl: string
  publicUrl: string
  objectKey: string
  contentType: string
}

export type CosPutPresignInput = CosPresignRequest

export type CosPutObjectInput = CosPresignRequest & {
  body: Buffer
}

export type CosPutObjectResult = {
  publicUrl: string
  objectKey: string
  contentType: string
}

export type CosEnvironment = {
  COS_SECRET_ID: string
  COS_SECRET_KEY: string
  COS_BUCKET: string
  COS_REGION: string
  COS_PUBLIC_BASE_URL?: string
}

import type {
  ImageUploadHandler,
  ImageUploadResult,
} from "@xtai-notion/editor-core"
import { apiRequest } from "@/lib/api-client"

export type CreateDocumentImageUploaderOptions = {
  apiUrl: string
  documentId: string
  userId: string
}

export type CreateDocumentCanvasImageFetcherOptions =
  CreateDocumentImageUploaderOptions

type PresignResponse = {
  publicUrl: string
}

function assertOk(response: Response, operation: string) {
  if (!response.ok) {
    throw new Error(`${operation} failed (${response.status})`)
  }
}

function getUploadError(error: unknown): Error {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return new Error(
      "无法连接到图片上传服务。请检查 API 是否已启动或网络连接。"
    )
  }
  return error instanceof Error ? error : new Error("图片上传失败")
}

function isPresignResponse(value: unknown): value is PresignResponse {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as PresignResponse).publicUrl === "string"
  )
}

export function createDocumentImageUploader({
  apiUrl,
  documentId,
  userId,
}: CreateDocumentImageUploaderOptions): ImageUploadHandler {
  return async (file, signal): Promise<ImageUploadResult> => {
    const formData = new FormData()
    formData.set("file", file)

    let uploadResponse: Response
    try {
      uploadResponse = await apiRequest({
        path: `/documents/${documentId}/images`,
        method: "POST",
        userId,
        body: formData,
        signal,
      })
    } catch (error) {
      throw getUploadError(error)
    }
    assertOk(uploadResponse, "Image upload")
    const result = (await uploadResponse.json()) as unknown
    if (!isPresignResponse(result)) {
      throw new Error("Invalid image upload response")
    }

    return { publicUrl: result.publicUrl, contentType: file.type }
  }
}

/** 通过 API 同源代理拉取 COS 图片，供画板导出/预览内联为 data URL。 */
export function createDocumentCanvasImageFetcher({
  apiUrl,
  documentId,
  userId,
}: CreateDocumentCanvasImageFetcherOptions) {
  return async (url: string, signal?: AbortSignal): Promise<Blob> => {
    const proxyPath = `/documents/${documentId}/images/proxy?url=${encodeURIComponent(url)}`
    let response: Response
    try {
      response = await apiRequest({
        path: proxyPath,
        userId,
        signal,
      })
    } catch (error) {
      throw getUploadError(error)
    }
    assertOk(response, "Canvas image fetch")
    return response.blob()
  }
}

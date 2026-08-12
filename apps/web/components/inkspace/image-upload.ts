import type { ImageUploadHandler, ImageUploadResult } from "@workspace/editor"

export type CreateDocumentImageUploaderOptions = {
  apiUrl: string
  documentId: string
  userId: string
}

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
      uploadResponse = await fetch(
        `${apiUrl.replace(/\/$/, "")}/documents/${documentId}/images`,
        {
          method: "POST",
          credentials: "include",
          signal,
          headers: {
            // keep x-dev-user-id for development; production will use cookie
            "x-dev-user-id": userId,
          },
          body: formData,
        }
      )
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

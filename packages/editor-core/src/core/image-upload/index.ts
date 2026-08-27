import type { Editor } from "@tiptap/core"

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

export type ImageUploadResult = {
  publicUrl: string
  contentType: string
}

export type ImageUploadHandler = (
  file: File,
  signal?: AbortSignal
) => Promise<ImageUploadResult>

export type ImageUploadConfig = {
  upload: ImageUploadHandler
}

export type ImageValidationErrorCode = "unsupported-type" | "file-too-large"

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; code: ImageValidationErrorCode; message: string }

export function validateImageFile(file: File): ImageValidationResult {
  if (!IMAGE_MIME_TYPES.includes(file.type as ImageMimeType)) {
    return {
      valid: false,
      code: "unsupported-type",
      message: "仅支持 JPEG、PNG、GIF 或 WebP 图片",
    }
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      code: "file-too-large",
      message: "图片大小不能超过 10MB",
    }
  }

  return { valid: true }
}

export async function uploadImage(
  file: File,
  config: ImageUploadConfig,
  signal?: AbortSignal
): Promise<ImageUploadResult> {
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  return config.upload(file, signal)
}

export function insertUploadedImage(
  editor: Editor,
  result: ImageUploadResult
): boolean {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: "image",
      attrs: { src: result.publicUrl },
    })
    .run()
}

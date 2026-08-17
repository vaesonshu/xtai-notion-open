import type { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types"
import type { ImageUploadHandler } from "../image-upload"
import { validateImageFile } from "../image-upload"

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

async function dataUrlToFile(dataUrl: string, fileId: string): Promise<File> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const extension = blob.type.split("/")[1] ?? "png"
  return new File([blob], `${fileId}.${extension}`, {
    type: blob.type || "image/png",
  })
}

/** 将画板 files 中的 base64 图片上传 COS，避免快照撑爆 Yjs 文档。 */
export async function externalizeCanvasFiles(
  files: BinaryFiles | undefined,
  upload: ImageUploadHandler | undefined
): Promise<BinaryFiles | undefined> {
  if (!files || !upload) {
    return files
  }

  let changed = false
  const next: BinaryFiles = { ...files }

  for (const [fileId, fileData] of Object.entries(files)) {
    if (!fileData?.dataURL || isHttpUrl(fileData.dataURL)) {
      continue
    }
    if (!fileData.dataURL.startsWith("data:")) {
      continue
    }

    const file = await dataUrlToFile(fileData.dataURL, fileId)
    const validation = validateImageFile(file)
    if (!validation.valid) {
      continue
    }

    const result = await upload(file)
    next[fileId] = {
      ...fileData,
      dataURL: result.publicUrl as BinaryFileData["dataURL"],
      mimeType: result.contentType as BinaryFileData["mimeType"],
    }
    changed = true
  }

  return changed ? next : files
}

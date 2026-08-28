import type { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types"
import type { ImageUploadHandler } from "../image-upload"
import { validateImageFile } from "../image-upload"

export type CanvasImageFetchHandler = (
  url: string,
  signal?: AbortSignal
) => Promise<Blob>

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"))
    reader.readAsDataURL(blob)
  })
}

async function fetchRemoteImageDataUrl(
  url: string,
  fetchRemote?: CanvasImageFetchHandler,
  signal?: AbortSignal
): Promise<string> {
  if (fetchRemote) {
    return blobToDataUrl(await fetchRemote(url, signal))
  }

  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    signal,
  })
  if (!response.ok) {
    throw new Error(`无法加载画板图片 (${response.status})`)
  }
  return blobToDataUrl(await response.blob())
}

/** 导出前将 COS 等远程 URL 内联为 data URL，避免 canvas 被跨域图片污染。 */
export async function inlineRemoteCanvasFiles(
  files: BinaryFiles,
  fetchRemote?: CanvasImageFetchHandler,
  signal?: AbortSignal
): Promise<BinaryFiles> {
  let changed = false
  const next: BinaryFiles = { ...files }

  await Promise.all(
    Object.entries(files).map(async ([fileId, fileData]) => {
      if (!fileData?.dataURL || !isHttpUrl(fileData.dataURL)) {
        return
      }

      const dataURL = await fetchRemoteImageDataUrl(
        fileData.dataURL,
        fetchRemote,
        signal
      )
      next[fileId] = {
        ...fileData,
        dataURL: dataURL as BinaryFileData["dataURL"],
      }
      changed = true
    })
  )

  return changed ? next : files
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

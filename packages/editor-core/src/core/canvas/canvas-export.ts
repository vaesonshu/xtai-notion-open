import { exportToBlob } from "@excalidraw/excalidraw"
import {
  inlineRemoteCanvasFiles,
  type CanvasImageFetchHandler,
} from "./canvas-files"

type ExportCanvasOptions = Parameters<typeof exportToBlob>[0]

/** 导出前内联远程图片，避免跨域 URL 污染 canvas 导致 toBlob 失败。 */
export async function exportCanvasToBlob(
  opts: ExportCanvasOptions,
  fetchRemote?: CanvasImageFetchHandler
) {
  const files = await inlineRemoteCanvasFiles(opts.files ?? {}, fetchRemote)
  return exportToBlob({ ...opts, files })
}

import {
  inlineRemoteCanvasFiles,
  type CanvasImageFetchHandler,
} from "./canvas-files"

// 仅用类型查询，避免顶层 import 在 Node（API）里拉起 Excalidraw
type ExportToBlob = (typeof import("@excalidraw/excalidraw"))["exportToBlob"]
type ExportCanvasOptions = Parameters<ExportToBlob>[0]

/** 导出前内联远程图片，避免跨域 URL 污染 canvas 导致 toBlob 失败。 */
export async function exportCanvasToBlob(
  opts: ExportCanvasOptions,
  fetchRemote?: CanvasImageFetchHandler
) {
  const { exportToBlob } = await import("@excalidraw/excalidraw")
  const files = await inlineRemoteCanvasFiles(opts.files ?? {}, fetchRemote)
  return exportToBlob({ ...opts, files })
}

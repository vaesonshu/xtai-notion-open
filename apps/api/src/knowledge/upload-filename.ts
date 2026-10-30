import path from "node:path"

/**
 * busboy 常把 Content-Disposition 里的 filename 按 latin1 读入 Node 字符串，
 * 浏览器 UTF-8 中文名会变成 æ–°å»º 这类乱码；按字节还原为 UTF-8。
 */
export function decodeMultipartFilename(originalname: string): string {
  return Buffer.from(originalname, "latin1").toString("utf8")
}

/** 优先用表单字段里的 UTF-8 文件名，否则从 multipart 的 originalname 解码。 */
export function resolveUploadFilename(
  preferred: string | undefined,
  originalname: string
): string {
  const trimmed = preferred?.trim()
  if (trimmed) {
    return path.basename(trimmed)
  }
  return path.basename(decodeMultipartFilename(originalname))
}

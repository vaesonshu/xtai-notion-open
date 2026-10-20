/** 触发浏览器下载 Blob，调用方负责 revoke 前的短暂窗口 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadText(content: string, filename: string, mime: string) {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), filename)
}

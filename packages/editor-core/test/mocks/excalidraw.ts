/** Vitest 替身：避免 excalidraw → roughjs 在 Node 测试环境解析失败。 */
export async function exportToBlob() {
  return new Blob()
}

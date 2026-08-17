import type { TLStoreSnapshot } from "tldraw"

/** 解析 TipTap 节点 attrs 中的 tldraw document 快照 JSON。 */
export function parseTldrawDocumentSnapshot(
  raw: unknown
): TLStoreSnapshot | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as TLStoreSnapshot
    if (!parsed || typeof parsed !== "object") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** 将 tldraw document 快照序列化进 TipTap attrs，供 Yjs 协作同步。 */
export function stringifyTldrawDocumentSnapshot(
  document: TLStoreSnapshot
): string {
  return JSON.stringify(document)
}

export function createCanvasBlockId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

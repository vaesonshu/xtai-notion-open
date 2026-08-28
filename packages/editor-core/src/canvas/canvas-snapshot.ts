import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import type { BinaryFiles } from "@excalidraw/excalidraw/types"

/** Excalidraw 场景快照：存入 TipTap canvasBlock.attrs.snapshot。 */
export type CanvasSnapshot = {
  elements: ExcalidrawElement[]
  files?: BinaryFiles
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** 解析节点 attrs 中的画板快照 JSON。 */
export function parseCanvasSnapshot(raw: unknown): CanvasSnapshot | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed.elements)) {
      return null
    }
    return {
      elements: parsed.elements as ExcalidrawElement[],
      files: isRecord(parsed.files) ? (parsed.files as BinaryFiles) : undefined,
    }
  } catch {
    return null
  }
}

/** 快照是否包含可渲染的画板元素（用于占位预览）。 */
export function hasCanvasContent(raw: unknown): boolean {
  const parsed = parseCanvasSnapshot(raw)
  return Boolean(parsed?.elements.some((element) => !element.isDeleted))
}

/** 将画板快照序列化进 TipTap attrs，供 Yjs 协作同步。 */
export function stringifyCanvasSnapshot(snapshot: CanvasSnapshot): string {
  return JSON.stringify({
    elements: snapshot.elements,
    ...(snapshot.files ? { files: snapshot.files } : {}),
  })
}

export function createCanvasBlockId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

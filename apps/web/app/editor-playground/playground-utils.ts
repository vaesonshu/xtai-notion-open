import type { EditorDocument } from "@xtai-notion/editor-core"

export function formatEditorSnapshot(document: EditorDocument): string {
  return JSON.stringify(document, null, 2)
}

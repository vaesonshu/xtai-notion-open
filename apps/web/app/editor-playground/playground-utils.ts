import type { EditorDocument } from "@workspace/editor"

export function formatEditorSnapshot(document: EditorDocument): string {
  return JSON.stringify(document, null, 2)
}

import type { Block } from "@workspace/editor"

export function formatEditorSnapshot(blocks: Block[]): string {
  return JSON.stringify(blocks, null, 2)
}

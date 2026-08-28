import type { Block } from "@xtai-notion/editor-core"

export function formatEditorSnapshot(blocks: Block[]): string {
  return JSON.stringify(blocks, null, 2)
}

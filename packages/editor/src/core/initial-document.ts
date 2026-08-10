import { createStarterDocument } from "./document.js"
import type { EditorDocument } from "./types.js"

export function createInitialDocument(): EditorDocument {
  return createStarterDocument()
}

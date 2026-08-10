import { createStarterDocument } from "./document"
import type { EditorDocument } from "./types"

export function createInitialDocument(): EditorDocument {
  return createStarterDocument()
}

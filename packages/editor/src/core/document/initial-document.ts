import { createStarterDocument } from "./index"
import type { EditorDocument } from "../types"

export function createInitialDocument(): EditorDocument {
  return createStarterDocument()
}

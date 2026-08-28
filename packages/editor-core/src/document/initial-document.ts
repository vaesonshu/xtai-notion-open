import { createStarterBlocks } from "../block-schema/documents"
import type { Block } from "../block-schema/types"

export function createInitialDocument(): Block[] {
  return createStarterBlocks()
}

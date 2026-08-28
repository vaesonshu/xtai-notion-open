import {
  createEmptyBlocks,
  createStarterBlocks,
} from "../block-schema/documents"
import type { Block } from "../block-schema/types"
import type { EditorDocument } from "../types"

/** @deprecated 请改用 createEmptyBlocks() */
export function createEmptyDocument(): Block[] {
  return createEmptyBlocks()
}

/** @deprecated 请改用 createStarterBlocks() */
export function createStarterDocument(): Block[] {
  return createStarterBlocks()
}

/** 校验值是否为旧版 TipTap doc JSON（块模型请用 isBlockArray） */
export function isEditorDocument(value: unknown): value is EditorDocument {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const candidate = value as { type?: unknown; content?: unknown }

  return candidate.type === "doc" && Array.isArray(candidate.content)
}

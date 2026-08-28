"use client"

import { createContext } from "react"
import type { BlockEditor } from "@xtai-notion/editor-core"
import type { CollaborationStatus } from "@xtai-notion/editor-react/collaboration/types"
import type { CollaborationUser } from "@xtai-notion/editor-core"

export type EditorContextValue = {
  blockEditor: BlockEditor | null
  collaborationStatus: CollaborationStatus | null
  collaborators: CollaborationUser[]
  /** 当前协作用户；非协作模式为 null。 */
  collaborationUser: CollaborationUser | null
  /** 声明正在编辑的画板，用于协作软锁。 */
  setCanvasEditing?: (canvasId: string | null) => void
  getCanvasEditor?: (canvasId: string) => CollaborationUser | null
}

export const EditorContext = createContext<EditorContextValue | null>(null)

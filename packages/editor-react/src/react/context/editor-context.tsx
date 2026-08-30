"use client"

import { createContext } from "react"
import type { Doc as YDoc } from "yjs"
import type { BlockEditor } from "@xtai-notion/editor-core"
import type { CollaborationStatus } from "@xtai-notion/editor-react/collaboration/types"
import type { CollaborationUser } from "@xtai-notion/editor-core"

/** 协作可见编辑器改绑：fork 绑本地副本，shared 绑回会话 Y.Doc。 */
export type RebindVisibleEditorInput =
  | { target: "shared"; editable: boolean }
  | { target: "fork"; document: YDoc; editable: boolean }

export type EditorContextValue = {
  blockEditor: BlockEditor | null
  collaborationStatus: CollaborationStatus | null
  collaborators: CollaborationUser[]
  /** 当前协作用户；非协作模式为 null。 */
  collaborationUser: CollaborationUser | null
  /** 用户是否具备文档编辑权限（与 AI fork 等临时只读态无关）。 */
  canEditDocument: boolean
  /** 协作绑定的共享 Y.Doc；非协作 provider 为 null。AI 写作 fork 以此为母本。 */
  sharedYDoc: YDoc | null
  /** 声明正在编辑的画板，用于协作软锁。 */
  setCanvasEditing?: (canvasId: string | null) => void
  getCanvasEditor?: (canvasId: string) => CollaborationUser | null
  /** 仅协作 provider 提供；改绑可见 BlockEditor，不销毁 Hocuspocus 会话。 */
  rebindVisibleEditor?: (input: RebindVisibleEditorInput) => BlockEditor
}

export const EditorContext = createContext<EditorContextValue | null>(null)

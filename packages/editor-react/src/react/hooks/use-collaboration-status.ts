"use client"

import { use } from "react"
import type { CollaborationStatus } from "@xtai-notion/editor-react/collaboration/types"
import { EditorContext } from "../context/editor-context"

export function useCollaborationStatus(): CollaborationStatus {
  const context = use(EditorContext)
  if (!context || context.collaborationStatus === null) {
    throw new Error(
      "useCollaborationStatus must be used inside @xtai-notion/editor-react CollaborationEditorProvider"
    )
  }
  return context.collaborationStatus
}

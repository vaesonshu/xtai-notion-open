"use client"

import { use } from "react"
import type { CollaborationStatus } from "../../collaboration/types"
import { EditorContext } from "../context/editor-context"

export function useCollaborationStatus(): CollaborationStatus {
  const context = use(EditorContext)
  if (!context || context.collaborationStatus === null) {
    throw new Error(
      "useCollaborationStatus must be used inside @workspace/editor CollaborationEditorProvider"
    )
  }
  return context.collaborationStatus
}

"use client"

import { use } from "react"
import type { CollaborationUser } from "@xtai-notion/editor-core"
import { EditorContext } from "../context/editor-context"

export function useCollaborators(): CollaborationUser[] {
  const context = use(EditorContext)
  if (!context || context.collaborationStatus === null) {
    throw new Error(
      "useCollaborators must be used inside @workspace/editor CollaborationEditorProvider"
    )
  }
  return context.collaborators
}

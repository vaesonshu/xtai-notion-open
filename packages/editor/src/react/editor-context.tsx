"use client"

import { createContext } from "react"
import type { Editor } from "@tiptap/core"
import type { CollaborationStatus } from "../collaboration/types"
import type { CollaborationUser } from "../core/types"

export type EditorContextValue = {
  editor: Editor | null
  collaborationStatus: CollaborationStatus | null
  collaborators: CollaborationUser[]
}

export const EditorContext = createContext<EditorContextValue | null>(null)

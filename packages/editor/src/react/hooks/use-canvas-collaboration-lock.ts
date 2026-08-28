"use client"

import { use, useCallback, useEffect, useRef } from "react"
import { EditorContext } from "../context/editor-context"
import type { CollaborationUser } from "@workspace/editor-core"

export function useCanvasCollaborationLock(
  canvasId: string | null | undefined
) {
  const context = use(EditorContext)
  const localUser = context?.collaborationUser ?? null
  const claimedRef = useRef(false)
  const lockHolder =
    canvasId && context?.getCanvasEditor
      ? context.getCanvasEditor(canvasId)
      : null
  const isLockedByOther = Boolean(
    lockHolder && localUser && lockHolder.id !== localUser.id
  )

  const claim = useCallback(() => {
    if (!canvasId || !context?.setCanvasEditing) {
      return
    }
    claimedRef.current = true
    context.setCanvasEditing(canvasId)
  }, [canvasId, context])

  const release = useCallback(() => {
    if (!claimedRef.current) {
      return
    }
    claimedRef.current = false
    context?.setCanvasEditing?.(null)
  }, [context])

  useEffect(() => {
    return () => {
      release()
    }
  }, [release])

  return {
    isLockedByOther,
    lockHolder: lockHolder as CollaborationUser | null,
    claim,
    release,
  }
}

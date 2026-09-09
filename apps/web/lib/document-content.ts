"use client"

import { documentFromYjs } from "@xtai-notion/editor-core"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import { AI_WRITE_MERGE_ORIGIN } from "@xtai-notion/editor-core"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Doc as YDoc } from "yjs"
import { apiRequest } from "@/lib/api-client"
import { toastError } from "@/lib/toast"

export type SoloSaveStatus = "idle" | "saving" | "saved" | "error"

const DEFAULT_DEBOUNCE_MS = 800

export function useSoloDocumentSave(options: {
  documentId: string
  userId: string
  sharedDocument: YDoc | null
  enabled: boolean
  debounceMs?: number
}): { status: SoloSaveStatus; flush: () => Promise<void> } {
  const { documentId, userId, sharedDocument, enabled } = options
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const [status, setStatus] = useState<SoloSaveStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(false)
  const flushingRef = useRef<Promise<void> | null>(null)

  const persistContent = useCallback(
    async (content: Block[]) => {
      setStatus("saving")
      try {
        const response = await apiRequest({
          path: `/documents/${encodeURIComponent(documentId)}/content`,
          method: "PUT",
          userId,
          json: { content },
        })
        if (!response.ok) {
          throw new Error(`保存失败 (${response.status})`)
        }
        setStatus("saved")
      } catch (error) {
        setStatus("error")
        toastError(error, "文档保存失败，请稍后重试")
        throw error
      }
    },
    [documentId, userId]
  )

  const flush = useCallback(async () => {
    if (!sharedDocument || !enabled) {
      return
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (flushingRef.current) {
      await flushingRef.current
      return
    }
    pendingRef.current = false
    const content = documentFromYjs(sharedDocument)
    flushingRef.current = persistContent(content).finally(() => {
      flushingRef.current = null
    })
    await flushingRef.current
  }, [enabled, persistContent, sharedDocument])

  const scheduleSave = useCallback(() => {
    pendingRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (!pendingRef.current) {
        return
      }
      void flush()
    }, debounceMs)
  }, [debounceMs, flush])

  useEffect(() => {
    if (!sharedDocument || !enabled) {
      return
    }

    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === AI_WRITE_MERGE_ORIGIN) {
        scheduleSave()
        return
      }
      scheduleSave()
    }

    sharedDocument.on("update", onUpdate)
    return () => {
      sharedDocument.off("update", onUpdate)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, scheduleSave, sharedDocument])

  useEffect(() => {
    if (!enabled) {
      return
    }
    const handleBeforeUnload = () => {
      if (!pendingRef.current || !sharedDocument) {
        return
      }
      const content = documentFromYjs(sharedDocument)
      void persistContent(content)
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [enabled, persistContent, sharedDocument])

  return { status, flush }
}

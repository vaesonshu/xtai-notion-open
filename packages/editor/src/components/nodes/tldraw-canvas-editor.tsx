"use client"

import { getAssetUrlsByMetaUrl } from "@tldraw/assets/urls"
import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  Tldraw,
  getSnapshot,
  loadSnapshot,
  type Editor,
  type TLStoreSnapshot,
} from "tldraw"
import "tldraw/tldraw.css"
import {
  parseTldrawDocumentSnapshot,
  stringifyTldrawDocumentSnapshot,
} from "../../core/canvas/tldraw-snapshot"

type TldrawCanvasEditorProps = {
  snapshot: string
  readOnly: boolean
  onSnapshotChange: (snapshot: string) => void
}

/** 嵌入式 tldraw 画布：快照写入 TipTap 节点 attrs，随文档 Yjs 同步。 */
export function TldrawCanvasEditor({
  snapshot,
  readOnly,
  onSnapshotChange,
}: TldrawCanvasEditorProps) {
  const assetUrls = useMemo(() => getAssetUrlsByMetaUrl(), [])
  const editorRef = useRef<Editor | null>(null)
  const lastPersistedRef = useRef(snapshot)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistDocument = useCallback(
    (editor: Editor) => {
      const { document } = getSnapshot(editor.store)
      const next = stringifyTldrawDocumentSnapshot(document)
      if (next === lastPersistedRef.current) {
        return
      }
      lastPersistedRef.current = next
      onSnapshotChange(next)
    },
    [onSnapshotChange]
  )

  const applyDocumentSnapshot = useCallback((editor: Editor, raw: string) => {
    const document = parseTldrawDocumentSnapshot(raw)
    if (!document) {
      return
    }
    loadSnapshot(editor.store, { document })
  }, [])

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      if (readOnly) {
        editor.updateInstanceState({ isReadonly: true })
      }
      applyDocumentSnapshot(editor, snapshot)
      lastPersistedRef.current = snapshot

      const unlisten = editor.store.listen(
        () => {
          if (readOnly) {
            return
          }
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
          }
          // 节流写入 attrs，避免每次笔触都触发 Yjs 同步风暴
          saveTimerRef.current = setTimeout(() => {
            persistDocument(editor)
          }, 400)
        },
        { scope: "document" }
      )

      return () => {
        unlisten()
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
        }
      }
    },
    [applyDocumentSnapshot, persistDocument, readOnly, snapshot]
  )

  // 远端协作者更新 snapshot 时重载画布内容
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || snapshot === lastPersistedRef.current) {
      return
    }
    applyDocumentSnapshot(editor, snapshot)
    lastPersistedRef.current = snapshot
  }, [applyDocumentSnapshot, snapshot])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }
    editor.updateInstanceState({ isReadonly: readOnly })
  }, [readOnly])

  return (
    <div className="editor-canvas-block__surface">
      <Tldraw assetUrls={assetUrls} onMount={handleMount} />
    </div>
  )
}

export type { TLStoreSnapshot }

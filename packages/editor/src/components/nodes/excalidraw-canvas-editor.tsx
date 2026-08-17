"use client"

import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw"
// CSS 必须在 JS 中 import：包 exports 未声明 style 条件，editor.css 里 @import 会失败
import "@excalidraw/excalidraw/index.css"
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types"
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import { externalizeCanvasFiles } from "../../core/canvas/canvas-files"
import {
  parseCanvasSnapshot,
  stringifyCanvasSnapshot,
} from "../../core/canvas/canvas-snapshot"
import type { ImageUploadHandler } from "../../core/image-upload"
import { useDocumentTheme } from "../../react/hooks/use-document-theme"

export type ExcalidrawCanvasEditorHandle = {
  flushPending: () => Promise<void>
  exportPng: () => Promise<void>
}

type ExcalidrawCanvasEditorProps = {
  snapshot: string
  readOnly: boolean
  imageUpload?: ImageUploadHandler
  onSnapshotChange: (snapshot: string) => void
  onEditingStart?: () => void
}

/** 嵌入式 Excalidraw 画板：快照写入 TipTap 节点 attrs，随文档 Yjs 同步。 */
export const ExcalidrawCanvasEditor = forwardRef<
  ExcalidrawCanvasEditorHandle,
  ExcalidrawCanvasEditorProps
>(function ExcalidrawCanvasEditor(
  { snapshot, readOnly, imageUpload, onSnapshotChange, onEditingStart },
  ref
) {
  const theme = useDocumentTheme()
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const lastPersistedRef = useRef(snapshot)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null)
  const pendingFilesRef = useRef<BinaryFiles | null>(null)

  // initialData 仅在挂载时生效，后续远端更新走 excalidrawAPI.updateScene
  const initialData = useMemo((): ExcalidrawInitialDataState => {
    const parsed = parseCanvasSnapshot(snapshot)
    if (!parsed) {
      return { elements: [] }
    }
    return {
      elements: parsed.elements,
      ...(parsed.files ? { files: parsed.files } : {}),
    }
  }, [])

  const persistScene = useCallback(
    async (
      elements: readonly ExcalidrawElement[],
      files: BinaryFiles,
      { force = false }: { force?: boolean } = {}
    ) => {
      if (readOnly) {
        return
      }

      const externalized = await externalizeCanvasFiles(files, imageUpload)
      const next = stringifyCanvasSnapshot({
        elements: [...elements],
        files: externalized,
      })
      if (!force && next === lastPersistedRef.current) {
        return
      }
      lastPersistedRef.current = next
      onSnapshotChange(next)
    },
    [imageUpload, onSnapshotChange, readOnly]
  )

  const flushPending = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const api = apiRef.current
    if (api) {
      await persistScene(api.getSceneElements(), api.getFiles(), {
        force: true,
      })
      return
    }

    if (pendingElementsRef.current && pendingFilesRef.current) {
      await persistScene(pendingElementsRef.current, pendingFilesRef.current, {
        force: true,
      })
    }
  }, [persistScene])

  const exportPng = useCallback(async () => {
    const api = apiRef.current
    if (!api) {
      return
    }

    const blob = await exportToBlob({
      elements: api.getSceneElements(),
      appState: {
        ...api.getAppState(),
        exportBackground: true,
        exportWithDarkMode: theme === "dark",
      },
      files: api.getFiles(),
      mimeType: "image/png",
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `canvas-${Date.now()}.png`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [theme])

  useImperativeHandle(ref, () => ({ flushPending, exportPng }), [
    exportPng,
    flushPending,
  ])

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      _appState: AppState,
      files: BinaryFiles
    ) => {
      if (readOnly) {
        return
      }

      pendingElementsRef.current = elements
      pendingFilesRef.current = files

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      // 节流写入 attrs，避免每次笔触都触发 Yjs 同步风暴
      saveTimerRef.current = setTimeout(() => {
        void persistScene(elements, files)
      }, 400)
    },
    [persistScene, readOnly]
  )

  // 远端协作者更新 snapshot 时重载画板内容
  useEffect(() => {
    const api = apiRef.current
    if (!api || snapshot === lastPersistedRef.current) {
      return
    }
    const parsed = parseCanvasSnapshot(snapshot)
    if (!parsed) {
      return
    }
    api.updateScene({
      elements: parsed.elements,
      ...(parsed.files ? { files: parsed.files } : {}),
    })
    lastPersistedRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    return () => {
      void flushPending()
    }
  }, [flushPending])

  return (
    <div className="editor-canvas-block__surface editor-canvas-block__surface--excalidraw">
      <Excalidraw
        initialData={initialData}
        theme={theme}
        langCode="zh-CN"
        viewModeEnabled={readOnly}
        onChange={handleChange}
        onPointerDown={onEditingStart}
        excalidrawAPI={(api) => {
          apiRef.current = api
        }}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: !readOnly,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  )
})

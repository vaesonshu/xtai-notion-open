"use client"

import { Excalidraw } from "@excalidraw/excalidraw"
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
import { toast } from "sonner"
import { exportCanvasToBlob } from "@xtai-notion/editor-core"
import {
  externalizeCanvasFiles,
  type CanvasImageFetchHandler,
} from "@xtai-notion/editor-core"
import {
  parseCanvasSnapshot,
  stringifyCanvasSnapshot,
} from "@xtai-notion/editor-core"
import type { ImageUploadHandler } from "@xtai-notion/editor-core"
import { useDocumentTheme } from "@xtai-notion/editor-react"

export type ExcalidrawCanvasEditorHandle = {
  flushPending: () => Promise<void>
  exportPng: () => Promise<void>
}

type ExcalidrawCanvasEditorProps = {
  snapshot: string
  readOnly: boolean
  imageUpload?: ImageUploadHandler
  imageFetch?: CanvasImageFetchHandler
  onSnapshotChange: (snapshot: string) => void
  onEditingStart?: () => void
}

function getPersistErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "画板保存失败，请稍后重试"
}

/** 嵌入式 Excalidraw 画板：快照写入 TipTap 节点 attrs，随文档 Yjs 同步。 */
export const ExcalidrawCanvasEditor = forwardRef<
  ExcalidrawCanvasEditorHandle,
  ExcalidrawCanvasEditorProps
>(function ExcalidrawCanvasEditor(
  {
    snapshot,
    readOnly,
    imageUpload,
    imageFetch,
    onSnapshotChange,
    onEditingStart,
  },
  ref
) {
  const theme = useDocumentTheme()
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const snapshotRef = useRef(snapshot)
  const lastPersistedRef = useRef(snapshot)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null)
  const pendingFilesRef = useRef<BinaryFiles | null>(null)

  snapshotRef.current = snapshot

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

  const applySnapshot = useCallback(
    (api: ExcalidrawImperativeAPI, raw: string) => {
      if (raw === lastPersistedRef.current) {
        return
      }
      const parsed = parseCanvasSnapshot(raw)
      if (!parsed) {
        return
      }
      api.updateScene({
        elements: parsed.elements,
        ...(parsed.files ? { files: parsed.files } : {}),
      })
      lastPersistedRef.current = raw
    },
    []
  )

  const showPersistError = useCallback(
    (
      error: unknown,
      elements: readonly ExcalidrawElement[],
      files: BinaryFiles
    ) => {
      const retry = () => {
        void persistSceneRef.current(elements, files, { force: true })
      }
      toast.error("画板保存失败", {
        description: getPersistErrorMessage(error),
        action: {
          label: "重试",
          onClick: retry,
        },
      })
    },
    []
  )

  const persistSceneRef = useRef<
    (
      elements: readonly ExcalidrawElement[],
      files: BinaryFiles,
      options?: { force?: boolean }
    ) => Promise<void>
  >(async () => undefined)

  const persistScene = useCallback(
    async (
      elements: readonly ExcalidrawElement[],
      files: BinaryFiles,
      { force = false }: { force?: boolean } = {}
    ) => {
      if (readOnly) {
        return
      }

      try {
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
      } catch (error) {
        pendingElementsRef.current = elements
        pendingFilesRef.current = files
        showPersistError(error, elements, files)
      }
    },
    [imageUpload, onSnapshotChange, readOnly, showPersistError]
  )

  persistSceneRef.current = persistScene

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

    try {
      const blob = await exportCanvasToBlob(
        {
          elements: api.getSceneElements(),
          appState: {
            ...api.getAppState(),
            exportBackground: true,
            exportWithDarkMode: theme === "dark",
          },
          files: api.getFiles(),
          mimeType: "image/png",
        },
        imageFetch
      )

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `canvas-${Date.now()}.png`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error("导出 PNG 失败", {
        description:
          error instanceof Error ? error.message : "画板包含无法导出的远程图片",
      })
    }
  }, [imageFetch, theme])

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
    if (!api) {
      return
    }
    applySnapshot(api, snapshot)
  }, [applySnapshot, snapshot])

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
          // API 就绪时补同步，避免协作者更新在挂载前被跳过
          applySnapshot(api, snapshotRef.current)
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

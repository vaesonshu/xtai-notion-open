"use client"

import { exportCanvasToBlob } from "../../core/canvas/canvas-export"
import type { CanvasImageFetchHandler } from "../../core/canvas/canvas-files"
import { useEffect, useState } from "react"
import {
  hasCanvasContent,
  parseCanvasSnapshot,
} from "../../core/canvas/canvas-snapshot"
import { useDocumentTheme } from "../../react/hooks/use-document-theme"

type CanvasThumbnailPreviewProps = {
  snapshot: string
  imageFetch?: CanvasImageFetchHandler
}

/** 懒加载占位：用 exportToBlob 生成静态缩略图，无需挂载完整 Excalidraw。 */
export function CanvasThumbnailPreview({
  snapshot,
  imageFetch,
}: CanvasThumbnailPreviewProps) {
  const theme = useDocumentTheme()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const hasContent = hasCanvasContent(snapshot)

  useEffect(() => {
    if (!hasContent) {
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current)
        }
        return null
      })
      setIsGenerating(false)
      return
    }

    const parsed = parseCanvasSnapshot(snapshot)
    if (!parsed) {
      return
    }

    let cancelled = false
    setIsGenerating(true)

    void exportCanvasToBlob(
      {
        elements: parsed.elements,
        files: parsed.files ?? {},
        appState: {
          exportBackground: true,
          exportWithDarkMode: theme === "dark",
        },
        mimeType: "image/png",
      },
      imageFetch
    )
      .then((blob: Blob) => {
        if (cancelled) {
          return
        }
        const nextUrl = URL.createObjectURL(blob)
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current)
          }
          return nextUrl
        })
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGenerating(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [hasContent, imageFetch, snapshot, theme])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  if (!hasContent) {
    return (
      <div className="editor-canvas-block__placeholder" role="status">
        <span>空白画板</span>
        <span className="editor-canvas-block__placeholder-hint">
          滚动到此处后加载编辑器
        </span>
      </div>
    )
  }

  if (isGenerating || !previewUrl) {
    return (
      <div className="editor-canvas-block__placeholder" role="status">
        预览生成中…
      </div>
    )
  }

  return (
    <div
      className="editor-canvas-block__preview"
      role="img"
      aria-label="画板预览"
    >
      <img
        className="editor-canvas-block__preview-image"
        src={previewUrl}
        alt=""
      />
      <span className="editor-canvas-block__preview-hint">
        滚动到此处进入编辑
      </span>
    </div>
  )
}

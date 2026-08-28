"use client"

import {
  DownloadIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
} from "../../icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog"
import { Button } from "../../ui/button"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import { useCanvasCollaborationLock } from "@xtai-notion/editor-react/hooks/use-canvas-collaboration-lock"
import { useInView } from "@xtai-notion/editor-react/hooks/use-in-view"
import type { ExcalidrawCanvasEditorHandle } from "./excalidraw-canvas-editor"

const ExcalidrawCanvasEditor = lazy(() =>
  import("./excalidraw-canvas-editor").then((module) => ({
    default: module.ExcalidrawCanvasEditor,
  }))
)

const CanvasThumbnailPreview = lazy(() =>
  import("./canvas-thumbnail-preview").then((module) => ({
    default: module.CanvasThumbnailPreview,
  }))
)

/** Excalidraw 画板 NodeView：包裹在 TipTap 原子块内，阻止 ProseMirror 接管指针事件。 */
export function CanvasBlockNode({
  editor,
  node,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canvasEditorRef = useRef<ExcalidrawCanvasEditorHandle>(null)
  const canvasId =
    typeof node.attrs.canvasId === "string" ? node.attrs.canvasId : undefined
  const readOnly = !editor.isEditable
  const snapshot =
    typeof node.attrs.snapshot === "string" ? node.attrs.snapshot : ""
  const { ref: viewportRef, isInView } = useInView<HTMLDivElement>()
  const { isLockedByOther, lockHolder, claim } =
    useCanvasCollaborationLock(canvasId)
  const shouldMountEditor = isInView || isFullscreen

  const imageUpload = useMemo(() => {
    const extension = editor.extensionManager.extensions.find(
      (item) => item.name === "canvas"
    )
    return extension?.options.upload as ImageUploadHandler | undefined
  }, [editor])

  const imageFetch = useMemo(() => {
    const extension = editor.extensionManager.extensions.find(
      (item) => item.name === "canvas"
    )
    return extension?.options.fetchImage as CanvasImageFetchHandler | undefined
  }, [editor])

  const effectiveReadOnly = readOnly || isLockedByOther

  // 全屏时锁定页面滚动，Esc 退出
  useEffect(() => {
    if (!isFullscreen) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void canvasEditorRef.current?.flushPending()
        setIsFullscreen(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isFullscreen])

  // 容器尺寸变化后通知 Excalidraw 重新计算画布视口
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"))
    })
    return () => cancelAnimationFrame(frame)
  }, [isFullscreen, shouldMountEditor])

  const toggleFullscreen = () => {
    if (isFullscreen) {
      void canvasEditorRef.current?.flushPending()
    }
    setIsFullscreen((value) => !value)
  }

  const removeBlock = () => {
    const pos = getPos()
    if (typeof pos === "number") {
      void canvasEditorRef.current?.flushPending()
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + 1 })
        .run()
    }
  }

  return (
    <NodeViewWrapper
      className={
        isFullscreen
          ? "editor-canvas-block editor-canvas-block--fullscreen"
          : "editor-canvas-block"
      }
      contentEditable={false}
      data-canvas-id={canvasId}
    >
      <div ref={viewportRef} className="editor-canvas-block__viewport">
        <div className="editor-canvas-block__header">
          <span className="editor-canvas-block__title">画板</span>
          <div className="editor-canvas-block__actions">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="导出 PNG"
              disabled={!shouldMountEditor}
              onClick={() => void canvasEditorRef.current?.exportPng()}
            >
              <DownloadIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={isFullscreen ? "退出全屏" : "全屏"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
            </Button>
            {editor.isEditable ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="删除画板"
                onClick={() => setDeleteOpen(true)}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        </div>

        {isLockedByOther && lockHolder ? (
          <div className="editor-canvas-block__lock-banner" role="status">
            {lockHolder.name} 正在编辑此画板，当前为只读
          </div>
        ) : null}

        {shouldMountEditor ? (
          <Suspense
            fallback={
              <div className="editor-canvas-block__loading" role="status">
                画板加载中…
              </div>
            }
          >
            <ExcalidrawCanvasEditor
              ref={canvasEditorRef}
              snapshot={snapshot}
              readOnly={effectiveReadOnly}
              imageUpload={imageUpload}
              imageFetch={imageFetch}
              onEditingStart={claim}
              onSnapshotChange={(next) => updateAttributes({ snapshot: next })}
            />
          </Suspense>
        ) : (
          <Suspense
            fallback={
              <div className="editor-canvas-block__placeholder" role="status">
                预览加载中…
              </div>
            }
          >
            <CanvasThumbnailPreview
              snapshot={snapshot}
              imageFetch={imageFetch}
            />
          </Suspense>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除画板？</AlertDialogTitle>
            <AlertDialogDescription>
              画板内容将从文档中移除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={removeBlock}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NodeViewWrapper>
  )
}

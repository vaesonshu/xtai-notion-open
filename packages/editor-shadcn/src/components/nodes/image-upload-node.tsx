"use client"

import {
  ImageIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  XIcon,
} from "../../icons"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "../../ui/button"
import { uploadImage } from "@xtai-notion/editor-core/image-upload"

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; file: File }
  | { status: "error"; file: File; message: string }

function formatFileSize(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`
}

/** Dropcursor 节点挂在编辑器 offsetParent 上，需直接隐藏 */
function suppressDropcursor() {
  for (const node of document.querySelectorAll(".ProseMirror-dropcursor")) {
    if (node instanceof HTMLElement) {
      node.style.visibility = "hidden"
    }
  }
}

function restoreDropcursor() {
  for (const node of document.querySelectorAll(".ProseMirror-dropcursor")) {
    if (node instanceof HTMLElement) {
      node.style.visibility = ""
    }
  }
}

/** image blockContent 的 NodeView：无 src 时显示上传区，有 src 时渲染图片 */
export function ImageBlockNode({
  editor,
  node,
  extension,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<UploadState>({ status: "idle" })
  const [isDragging, setIsDragging] = useState(false)

  const src =
    typeof node.attrs.src === "string" ? node.attrs.src.trim() : ""
  const upload = extension.options.upload as
    | ((file: File) => Promise<{ publicUrl: string; contentType: string }>)
    | undefined
  const canUpload = Boolean(upload && editor.isEditable)
  const showUploadUi = !src || state.status !== "idle"

  const remove = () => {
    const pos = getPos()
    if (typeof pos === "number") {
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + 1 })
        .run()
    }
  }

  const uploadFile = useCallback(
    async (file: File) => {
      if (!upload || !editor.isEditable) return

      setState({ status: "uploading", file })
      try {
        const result = await uploadImage(file, { upload })
        updateAttributes({
          src: result.publicUrl,
          uploadStatus: "uploaded",
        })
        setState({ status: "idle" })
      } catch (error) {
        setState({
          status: "error",
          file,
          message: error instanceof Error ? error.message : "图片上传失败",
        })
      }
    },
    [editor.isEditable, updateAttributes, upload]
  )

  const selectFile = () => {
    if (canUpload && state.status === "idle") {
      inputRef.current?.click()
    }
  }

  // ProseMirror Dropcursor 在 editorView.dom 上用原生监听器注册，
  // React 合成事件的 stopPropagation 拦不住，必须用原生冒泡阶段截断。
  useEffect(() => {
    if (!showUploadUi) {
      return
    }

    const el = wrapperRef.current
    if (!el) {
      return
    }

    const onDragEnter = (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      suppressDropcursor()
      if (canUpload) {
        setIsDragging(true)
      }
    }

    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
      // 捕获阶段截断，避免冒泡到 ProseMirror 根节点触发 Dropcursor
      event.stopPropagation()
      suppressDropcursor()
    }

    const onDragLeave = (event: DragEvent) => {
      event.stopPropagation()
      const related = event.relatedTarget
      if (!related || !el.contains(related as Node)) {
        setIsDragging(false)
        restoreDropcursor()
      }
    }

    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragging(false)
      restoreDropcursor()
      const file = Array.from(event.dataTransfer?.files ?? [])[0]
      if (file) {
        void uploadFile(file)
      }
    }

    el.addEventListener("dragenter", onDragEnter, true)
    el.addEventListener("dragover", onDragOver, true)
    el.addEventListener("dragleave", onDragLeave, true)
    el.addEventListener("drop", onDrop, true)

    return () => {
      el.removeEventListener("dragenter", onDragEnter, true)
      el.removeEventListener("dragover", onDragOver, true)
      el.removeEventListener("dragleave", onDragLeave, true)
      el.removeEventListener("drop", onDrop, true)
      restoreDropcursor()
    }
  }, [canUpload, showUploadUi, uploadFile])

  if (!showUploadUi) {
    return (
      <NodeViewWrapper
        as="figure"
        className="editor-image-block"
        contentEditable={false}
      >
        <img
          src={src}
          alt=""
          className="editor-image-block__img"
          data-type="image"
          draggable={false}
        />
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="editor-image-upload-node"
      contentEditable={false}
      data-dragging={isDragging}
    >
      {state.status === "idle" ? (
        <button
          type="button"
          className="editor-image-upload-node__dropzone"
          aria-label="选择或拖拽上传图片"
          onClick={selectFile}
        >
          <span className="editor-image-upload-node__icon" aria-hidden="true">
            <ImageIcon />
          </span>
          <span className="editor-image-upload-node__title">
            点击上传或拖拽图片到这里
          </span>
          <span className="editor-image-upload-node__description">
            支持 JPEG、PNG、GIF、WebP，最大 10MB
          </span>
        </button>
      ) : (
        <div className="editor-image-upload-node__progress" aria-live="polite">
          <ImageIcon aria-hidden="true" className="size-5 text-[#24866B]" />
          <div className="editor-image-upload-node__file">
            <span>{state.file.name}</span>
            <span>{formatFileSize(state.file.size)}</span>
            {state.status === "error" ? <span>{state.message}</span> : null}
          </div>
          {state.status === "uploading" ? (
            <LoaderCircleIcon
              aria-label="正在上传"
              className="size-4 animate-spin text-[#24866B]"
            />
          ) : (
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`重试上传 ${state.file.name}`}
                onClick={() => void uploadFile(state.file)}
              >
                <RotateCcwIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="移除图片上传"
                onClick={remove}
              >
                <XIcon />
              </Button>
            </div>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void uploadFile(file)
        }}
      />
    </NodeViewWrapper>
  )
}

/** @deprecated 请改用 ImageBlockNode */
export const ImageUploadNode = ImageBlockNode

"use client"

import {
  ImageIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  XIcon,
} from "@workspace/icons"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { uploadImage } from "../core/image-upload"

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; file: File }
  | { status: "error"; file: File; message: string }

function formatFileSize(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`
}

export function ImageUploadNode({ editor, extension, getPos }: NodeViewProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>({ status: "idle" })
  const [isDragging, setIsDragging] = useState(false)

  const upload = extension.options.upload
  const canUpload = Boolean(upload && editor.isEditable)

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

  const uploadFile = async (file: File) => {
    if (!upload || !editor.isEditable) return

    setState({ status: "uploading", file })
    try {
      const result = await uploadImage(file, { upload })
      const pos = getPos()
      if (typeof pos !== "number") return

      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + 1 })
        .insertContentAt(pos, {
          type: "image",
          attrs: { src: result.publicUrl, alt: file.name },
        })
        .run()
    } catch (error) {
      setState({
        status: "error",
        file,
        message: error instanceof Error ? error.message : "图片上传失败",
      })
    }
  }

  const selectFile = () => {
    if (canUpload && state.status === "idle") {
      inputRef.current?.click()
    }
  }

  return (
    <NodeViewWrapper
      className="editor-image-upload-node"
      data-dragging={isDragging}
    >
      {state.status === "idle" ? (
        <button
          type="button"
          className="editor-image-upload-node__dropzone"
          aria-label="选择或拖拽上传图片"
          onClick={selectFile}
          onDragEnter={(event) => {
            event.preventDefault()
            if (canUpload) setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            const file = Array.from(event.dataTransfer.files)[0]
            if (file) void uploadFile(file)
          }}
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

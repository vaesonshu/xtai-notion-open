"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { BlockEditor } from "@workspace/editor-core"
import type { Block } from "@workspace/editor-core/block-schema/types"
import { createInitialDocument } from "@workspace/editor-core/document/initial-document"
import type { ImageUploadHandler } from "@workspace/editor-core/image-upload"
import type { CanvasImageFetchHandler } from "@workspace/editor-core/canvas/canvas-files"
import { CanvasBlockNode } from "../../components/nodes/canvas-block-node-extension"
import { ImageUploadNode } from "../../components/nodes/image-upload-node-extension"
import { EditorContext } from "../context/editor-context"

export type EditorProviderProps = {
  initialContent?: Block[]
  editable?: boolean
  onChange?: (blocks: Block[]) => void
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  children: ReactNode
}

function createLocalBlockEditor(options: {
  initialContent?: Block[]
  editable: boolean
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
}): BlockEditor {
  return new BlockEditor({
    initialContent: options.initialContent ?? createInitialDocument(),
    editable: options.editable,
    extensions: {
      imageUpload: options.imageUpload,
      canvasImageFetch: options.canvasImageFetch,
      imageUploadNode: ImageUploadNode,
      canvasBlockNode: CanvasBlockNode,
    },
  })
}

export function EditorProvider({
  initialContent,
  editable = true,
  imageUpload,
  canvasImageFetch,
  onChange,
  children,
}: EditorProviderProps) {
  const blockEditorRef = useRef<BlockEditor | null>(null)
  // 首帧保持 null，与服务端 SSR 一致，避免水合时骨架屏与正文 DOM 不匹配
  const [blockEditor, setBlockEditor] = useState<BlockEditor | null>(null)

  useEffect(() => {
    if (!blockEditorRef.current) {
      const instance = createLocalBlockEditor({
        initialContent,
        editable,
        imageUpload,
        canvasImageFetch,
      })
      blockEditorRef.current = instance
      setBlockEditor(instance)
    }

    return () => {
      blockEditorRef.current?.destroy()
      blockEditorRef.current = null
      setBlockEditor(null)
    }
  }, []) // 内容变更由父级 key 触发重挂载，避免误覆盖本地编辑

  useEffect(() => {
    blockEditor?.setEditable(editable)
  }, [blockEditor, editable])

  useEffect(() => {
    if (!blockEditor || !onChange) {
      return
    }
    return blockEditor.onChange(onChange)
  }, [blockEditor, onChange])

  return (
    <EditorContext
      value={{
        blockEditor,
        collaborationStatus: null,
        collaborators: [],
        collaborationUser: null,
      }}
    >
      {children}
    </EditorContext>
  )
}

"use client"

import type { Node } from "@tiptap/core"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { BlockEditor, createStarterBlocks } from "@xtai-notion/editor-core"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import type { EditorSchema } from "@xtai-notion/editor-core/schema"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import { EditorContext } from "../context/editor-context"

export type EditorProviderProps = {
  initialContent?: Block[]
  editable?: boolean
  onChange?: (blocks: Block[]) => void
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  /** shadcn 等 UI 层注入的 NodeView 扩展；省略时使用 core 默认节点定义。 */
  imageUploadNode?: Node
  canvasBlockNode?: Node
  /** 带 React NodeView 的自定义 schema（优先于 canvasBlockNode 覆盖） */
  editorSchema?: EditorSchema
  children: ReactNode
}

function createLocalBlockEditor(options: {
  initialContent?: Block[]
  editable: boolean
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  imageUploadNode?: Node
  canvasBlockNode?: Node
  editorSchema?: EditorSchema
}): BlockEditor {
  return new BlockEditor({
    initialContent: options.initialContent ?? createStarterBlocks(),
    editable: options.editable,
    editorSchema: options.editorSchema,
    extensions: {
      imageUpload: options.imageUpload,
      canvasImageFetch: options.canvasImageFetch,
      imageUploadNode: options.imageUploadNode,
      canvasBlockNode: options.canvasBlockNode,
    },
  })
}

export function EditorProvider({
  initialContent,
  editable = true,
  imageUpload,
  canvasImageFetch,
  imageUploadNode,
  canvasBlockNode,
  editorSchema,
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
        imageUploadNode,
        canvasBlockNode,
        editorSchema,
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
        // 非协作没有共享 Y.Doc，可见编辑器始终绑本地实例
        rebindVisibleEditor: undefined,
      }}
    >
      {children}
    </EditorContext>
  )
}

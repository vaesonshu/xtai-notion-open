"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type { Doc as YDoc } from "yjs"
import type { Block } from "@xtai-notion/editor-core/model/types"
import type { Node } from "@tiptap/core"
import type { EditorSchema } from "@xtai-notion/editor-core/schema"
import type { ImageUploadHandler } from "@xtai-notion/editor-core/image-upload"
import type { CanvasImageFetchHandler } from "@xtai-notion/editor-core/canvas/canvas-files"
import type { BlockEditor } from "@xtai-notion/editor-core"
import {
  EditorContext,
  type RebindVisibleEditorInput,
} from "../context/editor-context"
import {
  createLocalBlockEditor,
  createReboundVisibleBlockEditor,
  createSoloYjsBlockEditor,
} from "../lib/block-editor-factory"

export type EditorProviderProps = {
  initialContent?: Block[]
  /** 绑定本地 Y.Doc（solo REST 模式），供 AI 写作 fork 与 Yjs 编辑。 */
  sharedDocument?: YDoc
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

export function EditorProvider({
  initialContent,
  sharedDocument,
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
  const createOptionsRef = useRef({
    editable,
    initialContent,
    imageUpload,
    canvasImageFetch,
    imageUploadNode,
    canvasBlockNode,
    editorSchema,
  })
  const visibleEditableLockRef = useRef<boolean | null>(null)

  useEffect(() => {
    createOptionsRef.current = {
      editable,
      initialContent,
      imageUpload,
      canvasImageFetch,
      imageUploadNode,
      canvasBlockNode,
      editorSchema,
    }
  }, [
    canvasBlockNode,
    canvasImageFetch,
    editable,
    editorSchema,
    imageUpload,
    imageUploadNode,
    initialContent,
  ])

  useEffect(() => {
    if (!blockEditorRef.current) {
      const options = createOptionsRef.current
      const instance = sharedDocument
        ? createSoloYjsBlockEditor({
            ...options,
            document: sharedDocument,
          })
        : createLocalBlockEditor(options)
      blockEditorRef.current = instance
      setBlockEditor(instance)
    }

    return () => {
      blockEditorRef.current?.destroy()
      blockEditorRef.current = null
      setBlockEditor(null)
    }
  }, [sharedDocument])

  const rebindVisibleEditor = useCallback(
    (input: RebindVisibleEditorInput) => {
      if (!sharedDocument) {
        throw new Error("rebindVisibleEditor requires sharedDocument")
      }
      const options = createOptionsRef.current
      visibleEditableLockRef.current =
        input.target === "fork" ? input.editable : null
      const nextEditor = createReboundVisibleBlockEditor({
        ...options,
        input,
        soloSharedDocument: sharedDocument,
      })
      blockEditorRef.current = nextEditor
      setBlockEditor(nextEditor)
      return nextEditor
    },
    [sharedDocument]
  )

  useEffect(() => {
    blockEditor?.setEditable(visibleEditableLockRef.current ?? editable)
  }, [editable, blockEditor])

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
        // solo Y.Doc 就绪即视为 synced，AI 写作与工具栏可复用协作态语义
        collaborationStatus: sharedDocument
          ? blockEditor
            ? "synced"
            : "connecting"
          : null,
        collaborators: [],
        collaborationUser: null,
        canEditDocument: editable,
        sharedYDoc: sharedDocument ?? null,
        rebindVisibleEditor: sharedDocument ? rebindVisibleEditor : undefined,
      }}
    >
      {children}
    </EditorContext>
  )
}

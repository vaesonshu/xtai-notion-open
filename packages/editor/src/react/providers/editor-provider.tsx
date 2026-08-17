"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Editor } from "@tiptap/core"
import { EditorContext } from "../context/editor-context"
import { createEditorExtensions } from "../../core/extensions"
import { createInitialDocument } from "../../core/document/initial-document"
import type { EditorDocument } from "../../core/types"
import type { ImageUploadHandler } from "../../core/image-upload"
import type { CanvasImageFetchHandler } from "../../core/canvas/canvas-files"
import { CanvasBlockNode } from "../../components/nodes/canvas-block-node-extension"
import { ImageUploadNode } from "../../components/nodes/image-upload-node-extension"

export type EditorProviderProps = {
  initialContent?: EditorDocument
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  children: ReactNode
}

function createLocalEditor(options: {
  initialContent?: EditorDocument
  editable: boolean
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
}): Editor {
  return new Editor({
    extensions: createEditorExtensions({
      imageUpload: options.imageUpload,
      canvasImageFetch: options.canvasImageFetch,
      imageUploadNode: ImageUploadNode,
      canvasBlockNode: CanvasBlockNode,
    }),
    content: options.initialContent ?? createInitialDocument(),
    editable: options.editable,
    // Next.js 需显式关闭首帧渲染，避免 SSR/水合与软导航后正文空白
    immediatelyRender: false,
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
  const editorRef = useRef<Editor | null>(null)
  // 首帧保持 null，与服务端 SSR 一致，避免水合时骨架屏与正文 DOM 不匹配
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(() => {
    if (!editorRef.current) {
      const instance = createLocalEditor({
        initialContent,
        editable,
        imageUpload,
        canvasImageFetch,
      })
      editorRef.current = instance
      setEditor(instance)
    }

    return () => {
      editorRef.current?.destroy()
      editorRef.current = null
      setEditor(null)
    }
  }, []) // 内容变更由父级 key 触发重挂载，避免误覆盖本地编辑

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor || !onChange) {
      return
    }
    const handleUpdate = () => onChange(editor.getJSON() as EditorDocument)
    editor.on("update", handleUpdate)
    return () => {
      editor.off("update", handleUpdate)
    }
  }, [editor, onChange])

  return (
    <EditorContext
      value={{
        editor,
        collaborationStatus: null,
        collaborators: [],
        collaborationUser: null,
      }}
    >
      {children}
    </EditorContext>
  )
}

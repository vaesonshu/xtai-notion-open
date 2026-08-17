"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Editor } from "@tiptap/core"
import { EditorContext } from "../context/editor-context"
import { createEditorExtensions } from "../../core/extensions"
import { createInitialDocument } from "../../core/document/initial-document"
import type { EditorDocument } from "../../core/types"
import type { ImageUploadHandler } from "../../core/image-upload"
import { ImageUploadNode } from "../../components/nodes/image-upload-node-extension"

export type EditorProviderProps = {
  initialContent?: EditorDocument
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  imageUpload?: ImageUploadHandler
  children: ReactNode
}

function createLocalEditor(options: {
  initialContent?: EditorDocument
  editable: boolean
  imageUpload?: ImageUploadHandler
}): Editor {
  return new Editor({
    extensions: createEditorExtensions({
      imageUpload: options.imageUpload,
      imageUploadNode: ImageUploadNode,
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
  onChange,
  children,
}: EditorProviderProps) {
  const editorRef = useRef<Editor | null>(null)
  const [editor, setEditor] = useState<Editor | null>(() => {
    if (typeof window === "undefined") {
      return null
    }
    // 软导航纯客户端挂载时首帧即可创建，正文无需等待 useEffect
    const instance = createLocalEditor({ initialContent, editable, imageUpload })
    editorRef.current = instance
    return instance
  })

  useEffect(() => {
    if (!editorRef.current) {
      const instance = createLocalEditor({ initialContent, editable, imageUpload })
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
      }}
    >
      {children}
    </EditorContext>
  )
}

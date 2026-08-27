"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import type { Node } from "@tiptap/core"
import { Editor } from "@tiptap/core"
import {
  createEditorExtensions,
  createInitialDocument,
  type CanvasImageFetchHandler,
  type EditorDocument,
  type ImageUploadHandler,
} from "@xtai-notion/editor-core"
import { EditorContext } from "../context/editor-context"

export type EditorProviderProps = {
  initialContent?: EditorDocument
  editable?: boolean
  onChange?: (document: EditorDocument) => void
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  /** ?? React NodeView ??????????? core ? Node? */
  imageUploadNode?: Node
  /** ?? Excalidraw NodeView ???????? core ? Node? */
  canvasBlockNode?: Node
  children: ReactNode
}

type EditorInitOptions = ConstructorParameters<typeof Editor>[0] & {
  immediatelyRender?: boolean
}

function createLocalEditor(options: {
  initialContent?: EditorDocument
  editable: boolean
  imageUpload?: ImageUploadHandler
  canvasImageFetch?: CanvasImageFetchHandler
  imageUploadNode?: Node
  canvasBlockNode?: Node
}): Editor {
  return new Editor({
    extensions: createEditorExtensions({
      imageUpload: options.imageUpload,
      canvasImageFetch: options.canvasImageFetch,
      imageUploadNode: options.imageUploadNode,
      canvasBlockNode: options.canvasBlockNode,
    }),
    content: options.initialContent ?? createInitialDocument(),
    editable: options.editable,
    immediatelyRender: false,
  } as EditorInitOptions)
}

export function EditorProvider({
  initialContent,
  editable = true,
  imageUpload,
  canvasImageFetch,
  imageUploadNode,
  canvasBlockNode,
  onChange,
  children,
}: EditorProviderProps) {
  const editorRef = useRef<Editor | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(() => {
    if (!editorRef.current) {
      const instance = createLocalEditor({
        initialContent,
        editable,
        imageUpload,
        canvasImageFetch,
        imageUploadNode,
        canvasBlockNode,
      })
      editorRef.current = instance
      setEditor(instance)
    }

    return () => {
      editorRef.current?.destroy()
      editorRef.current = null
      setEditor(null)
    }
  }, [])

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

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  use,
  type ReactNode,
} from "react"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"

export type ImageUploadControls = {
  canUpload: boolean
  openFilePicker: () => void
}

const ImageUploadContext = createContext<ImageUploadControls | null>(null)

export function useImageUpload(): ImageUploadControls {
  return (
    useContext(ImageUploadContext) ?? {
      canUpload: false,
      openFilePicker: () => {},
    }
  )
}

export function ImageUpload({ children }: { children?: ReactNode }) {
  const blockEditor = use(EditorContext)?.blockEditor
  const editor = blockEditor?.tiptap
  const uploadExtension = editor?.extensionManager?.extensions?.find(
    (extension) => extension.name === "imageUpload"
  )
  const canUpload = Boolean(
    uploadExtension?.options.upload && editor?.isEditable
  )

  const openFilePicker = useCallback(() => {
    if (canUpload && editor) {
      editor.chain().focus().insertImageUpload().run()
    }
  }, [canUpload, editor])

  const controls = useMemo(
    () => ({ canUpload, openFilePicker }),
    [canUpload, openFilePicker]
  )

  return (
    <ImageUploadContext.Provider value={controls}>
      {children}
    </ImageUploadContext.Provider>
  )
}

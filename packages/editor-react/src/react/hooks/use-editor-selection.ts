"use client"

import { useEffect, useState } from "react"
import { useEditorInstance } from "./use-editor-instance"

export function useEditorSelection(): number {
  const editor = useEditorInstance()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const handleSelectionUpdate = () => setVersion((current) => current + 1)
    editor.on("selectionUpdate", handleSelectionUpdate)
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor])

  return version
}

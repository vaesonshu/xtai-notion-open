"use client"

import { useEffect, useState } from "react"
import { useEditorInstance } from "./use-editor-instance.js"

export function useEditorChange(): number {
  const editor = useEditorInstance()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const handleUpdate = () => setVersion(current => current + 1)
    editor.on("update", handleUpdate)
    return () => { editor.off("update", handleUpdate) }
  }, [editor])

  return version
}

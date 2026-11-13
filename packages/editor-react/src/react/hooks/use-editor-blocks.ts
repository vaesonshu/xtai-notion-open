"use client"

import { useEffect, useState } from "react"
import type { Block } from "@xtai-notion/editor-core/model/types"
import { useBlockEditor } from "./use-block-editor"

export type UseEditorBlocksOptions = {
  /** 每次文档结构变化时触发，适合 console.log 或上报调试。 */
  onChange?: (blocks: Block[]) => void
}

/**
 * 订阅当前 Block[] 文档树；输入、换行、改块类型等都会触发更新。
 * 需在 EditorProvider / CollaborationEditorProvider 内部使用。
 */
export function useEditorBlocks(options?: UseEditorBlocksOptions): Block[] {
  const blockEditor = useBlockEditor()
  const onChange = options?.onChange
  const [blocks, setBlocks] = useState<Block[]>(() => blockEditor.document)

  useEffect(() => {
    return blockEditor.onChange((next) => {
      setBlocks(next)
      onChange?.(next)
    })
  }, [blockEditor, onChange])

  return blocks
}

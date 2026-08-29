"use client"

import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import { DocumentEditor } from "../editor/document-editor"

export type AiWriteDraftProps = {
  blocks: Block[]
}

/**
 * 无协作、只读的草稿预览；左侧 AI 色条区分于正文。
 * 由宿主传入 extractDraftBlocks 等产出的块列表。
 */
export function AiWriteDraft({ blocks }: AiWriteDraftProps) {
  if (blocks.length === 0) {
    return null
  }

  return (
    <div
      data-testid="ai-write-draft"
      className="overflow-hidden rounded-lg border border-[#E8E4DC] border-l-2 border-l-[#8bc6ff] bg-white shadow-[0_4px_16px_rgba(36,35,33,0.08)]"
    >
      <DocumentEditor content={blocks} editable={false} />
    </div>
  )
}

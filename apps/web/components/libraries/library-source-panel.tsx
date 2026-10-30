"use client"

import type { ChangeEvent, RefObject } from "react"
import { FileTextIcon, PlusIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { LibrarySource, ReadableDocumentHit } from "@/lib/library-api"
import { LibrarySourceStatusBadge } from "@/components/libraries/library-source-status-badge"

type LibrarySourcePanelProps = {
  canEdit: boolean
  sources: LibrarySource[]
  uploadError: string | null
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  documentQuery: string
  onDocumentQueryChange: (value: string) => void
  documentHits: ReadableDocumentHit[]
  onPickDocument: (documentId: string) => void
  onReindex: (sourceId: string) => void
  onDeleteSource: (source: LibrarySource) => void
}

/** 左侧知识来源面板：上传、文档导入与来源列表（主流 RAG 产品常见布局）。 */
export function LibrarySourcePanel({
  canEdit,
  sources,
  uploadError,
  fileInputRef,
  onFileChange,
  documentQuery,
  onDocumentQueryChange,
  documentHits,
  onPickDocument,
  onReindex,
  onDeleteSource,
}: LibrarySourcePanelProps) {
  const readyCount = sources.filter((item) => item.status === "ready").length

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-[#ECEAE4] bg-white lg:w-[min(100%,360px)] lg:shrink-0 lg:border-r">
      <div className="shrink-0 border-b border-[#ECEAE4] px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#242321]">知识来源</h2>
          <span className="text-xs text-[#78746C]">
            {readyCount}/{sources.length} 已就绪
          </span>
        </div>
        {canEdit ? (
          <div className="mt-3 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={onFileChange}
            />
            <Button
              variant="outline"
              className="h-9 w-full justify-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <PlusIcon className="size-4" />
              上传文件
            </Button>
            <div className="relative">
              <Input
                className="h-9"
                placeholder="搜索站内文档并导入"
                value={documentQuery}
                onChange={(event) => onDocumentQueryChange(event.target.value)}
              />
              {documentHits.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[#ECEAE4] bg-white shadow-md">
                  {documentHits.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className="w-full truncate px-3 py-2 text-left text-sm hover:bg-[#F7F6F3]"
                        onClick={() => onPickDocument(doc.id)}
                      >
                        {doc.title || "未命名文档"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className="text-[11px] leading-4 text-[#78746C]">
              支持 txt、md、pdf、docx，单文件最大 20MB
            </p>
          </div>
        ) : null}
        {uploadError ? (
          <p className="mt-2 text-sm text-[#B42318]">{uploadError}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#ECEAE4] bg-[#FCFCFB] px-4 py-12 text-center">
            <FileTextIcon className="size-8 text-[#C4C0B8]" />
            <p className="mt-3 text-sm font-medium text-[#373532]">
              还没有知识来源
            </p>
            <p className="mt-1 text-xs text-[#78746C]">
              上传文件或导入文档后即可问答
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li
                key={source.id}
                className="rounded-xl border border-[#ECEAE4] bg-[#FCFCFB] px-3 py-3"
              >
                <div className="flex items-start gap-2">
                  <FileTextIcon className="mt-0.5 size-4 shrink-0 text-[#78746C]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-[#242321]">
                        {source.title}
                      </p>
                      <LibrarySourceStatusBadge source={source} />
                    </div>
                    {source.errorMessage ? (
                      <p className="mt-1 text-xs leading-5 text-[#B42318]">
                        {source.errorMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
                {canEdit ? (
                  <div className="mt-2 flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onReindex(source.id)}
                    >
                      重新索引
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[#78746C]"
                      onClick={() => onDeleteSource(source)}
                    >
                      删除
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

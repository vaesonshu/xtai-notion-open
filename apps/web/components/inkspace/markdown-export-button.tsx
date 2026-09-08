"use client"

import { blocksToMarkdown } from "@xtai-notion/editor-core"
import { useBlockEditor } from "@xtai-notion/editor-react"
import { DownloadIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { PencilIcon } from "./icon"
import { toast, toastError } from "@/lib/toast"

type MarkdownExportButtonProps = {
  filename?: string
}

/** 将当前编辑器 Block[] 导出为 Markdown 文件下载 */
export function MarkdownExportButton({
  filename = "document.md",
}: MarkdownExportButtonProps) {
  const editor = useBlockEditor()

  function exportMarkdown() {
    try {
      const markdown = blocksToMarkdown(editor.document)
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const downloadName = filename.endsWith(".md")
        ? filename
        : `${filename}.md`
      anchor.href = url
      anchor.download = downloadName
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("Markdown 导出成功")
    } catch (error) {
      toastError(error, "导出失败")
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="导出 Markdown"
            onClick={exportMarkdown}
            className="!text-[#615E58] hover:!bg-[#F3F2EF]"
          />
        }
      >
        <PencilIcon icon={DownloadIcon} size={17} color="#615E58" />
      </TooltipTrigger>
      <TooltipContent>导出 Markdown</TooltipContent>
    </Tooltip>
  )
}

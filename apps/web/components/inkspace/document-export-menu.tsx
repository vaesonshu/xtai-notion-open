"use client"

import {
  blocksToHtml,
  blocksToMarkdown,
  documentToPlainText,
  wrapExportHtmlDocument,
} from "@xtai-notion/editor-core"
import { useBlockEditor } from "@xtai-notion/editor-react"
import { DownloadIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { downloadText } from "@/lib/download-file"
import { toast, toastError } from "@/lib/toast"
import { PencilIcon } from "./icon"

type DocumentExportMenuProps = {
  /** 下载文件名（不含扩展名） */
  basename?: string
}

function sanitizeBasename(name: string) {
  const trimmed = name.trim() || "document"
  return trimmed.replace(/[\\/:*?"<>|]/g, "_")
}

/** 固定工具栏：点击打开导出格式菜单 */
export function DocumentExportMenu({
  basename = "document",
}: DocumentExportMenuProps) {
  const editor = useBlockEditor()
  const fileBase = sanitizeBasename(basename)

  function exportMarkdown() {
    try {
      const markdown = blocksToMarkdown(editor.document)
      downloadText(markdown, `${fileBase}.md`, "text/markdown")
      toast.success("Markdown 导出成功")
    } catch (error) {
      toastError(error, "导出失败")
    }
  }

  function exportHtml() {
    try {
      const body = blocksToHtml(editor.document)
      const html = wrapExportHtmlDocument(fileBase, body)
      downloadText(html, `${fileBase}.html`, "text/html")
      toast.success("HTML 导出成功")
    } catch (error) {
      toastError(error, "导出失败")
    }
  }

  function exportPlainText() {
    try {
      const text = documentToPlainText(editor.document)
      downloadText(text, `${fileBase}.txt`, "text/plain")
      toast.success("纯文本导出成功")
    } catch (error) {
      toastError(error, "导出失败")
    }
  }

  function exportPdfViaPrint() {
    try {
      const body = blocksToHtml(editor.document)
      const html = wrapExportHtmlDocument(fileBase, body)
      const printWindow = window.open("", "_blank", "noopener,noreferrer")
      if (!printWindow) {
        toast.error("无法打开打印窗口，请允许弹出窗口后重试")
        return
      }
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      window.setTimeout(() => {
        printWindow.print()
      }, 300)
      toast.success("请在打印对话框中选择「另存为 PDF」")
    } catch (error) {
      toastError(error, "导出失败")
    }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="选择导出格式"
                  className="!text-[#615E58] hover:!bg-[#F3F2EF]"
                />
              }
            />
          }
        >
          <PencilIcon icon={DownloadIcon} size={17} color="#615E58" />
        </TooltipTrigger>
        <TooltipContent>选择导出格式</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportMarkdown}>
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportHtml}>HTML (.html)</DropdownMenuItem>
        <DropdownMenuItem onClick={exportPlainText}>
          纯文本 (.txt)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdfViaPrint}>
          PDF（通过打印…）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

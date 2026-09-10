"use client"

import { useState } from "react"
import { UsersIcon } from "@workspace/icons"
import { toast, toastError } from "@/lib/toast"
import { apiRequest } from "@/lib/api-client"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { PencilIcon } from "./icon"

export type ShareDialogProps = {
  apiUrl?: string
  documentId: string
  disabled?: boolean
  /** 创建分享链接前持久化 solo 草稿（须在服务端切到 realtime 之前） */
  onPrepareShare?: () => Promise<void>
  /** 分享链接就绪后通知父级切换到 realtime 协作 */
  onShareEnabled?: () => void
}

export function ShareDialog({
  apiUrl,
  documentId,
  disabled = false,
  onPrepareShare,
  onShareEnabled,
}: ShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  async function createLink() {
    setLoading(true)
    try {
      // Share link flips collaboration policy to realtime; flush solo edits first.
      if (onPrepareShare) {
        await onPrepareShare()
      }
      const response = await apiRequest({
        path: `/api/documents/${encodeURIComponent(documentId)}/share-link`,
        method: "POST",
      })
      if (!response.ok) {
        throw new Error("无法生成分享链接，请稍后重试")
      }
      const body = (await response.json()) as { token?: string }
      if (!body.token) {
        throw new Error("分享链接响应无效")
      }
      // Keep the generated URL same-origin so cookies and login handoff work.
      setShareUrl(`${window.location.origin}/share/${body.token}`)
      onShareEnabled?.()
    } catch (cause) {
      toastError(cause, "无法生成分享链接")
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    toast.success("已复制分享链接")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen && !shareUrl && !loading) void createLink()
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="!text-[#373532] hover:!border-[#CFCBC4] hover:!bg-[#F3F2EF] hover:!text-[#373532]"
          />
        }
      >
        <PencilIcon icon={UsersIcon} color="#4F4C47" />
        分享
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分享文档</DialogTitle>
          <DialogDescription>
            通过此链接加入文档，访问者将获得可编辑权限。
          </DialogDescription>
        </DialogHeader>
        {loading && <p role="status">正在生成分享链接…</p>}
        {shareUrl && (
          <div className="flex gap-2">
            <Input aria-label="分享链接" readOnly value={shareUrl} />
            <Button type="button" onClick={() => void copyLink()}>
              复制
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

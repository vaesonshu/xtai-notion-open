"use client"

import { useState } from "react"
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

export type ShareDialogProps = {
  apiUrl?: string
  documentId: string
  disabled?: boolean
}

export function ShareDialog({
  apiUrl,
  documentId,
  disabled = false,
}: ShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function createLink() {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const response = await fetch(
        `/documents/${encodeURIComponent(documentId)}/share-link`,
        { method: "POST", credentials: "include" }
      )
      if (!response.ok) {
        throw new Error("无法生成分享链接，请稍后重试")
      }
      const body = (await response.json()) as { token?: string }
      if (!body.token) {
        throw new Error("分享链接响应无效")
      }
      // Keep the generated URL same-origin so cookies and login handoff work.
      setShareUrl(`${window.location.origin}/share/${body.token}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法生成分享链接")
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
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
        render={<Button variant="outline" size="sm" disabled={disabled} />}
      >
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
        {error && <p role="alert">{error}</p>}
        {shareUrl && (
          <div className="flex gap-2">
            <Input aria-label="分享链接" readOnly value={shareUrl} />
            <Button type="button" onClick={() => void copyLink()}>
              {copied ? "已复制" : "复制"}
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

"use client"

import { Clock3Icon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { useCallback, useEffect, useState } from "react"
import { toast, toastError } from "@/lib/toast"
import { PencilIcon } from "./icon"

type DocumentVersion = {
  id: string
  sequence: number
  createdAt: string
  excerpt: string
}

type DocumentVersionHistoryProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiUrl: string
  documentId: string
  userId: string
  canWrite: boolean
  onRestored?: () => void
}

function formatVersionTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** 文档版本历史：列出 Yjs 快照，支持手动保存与回滚 */
export function DocumentVersionHistory({
  open,
  onOpenChange,
  apiUrl,
  documentId,
  userId,
  canWrite,
  onRestored,
}: DocumentVersionHistoryProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<DocumentVersion | null>(
    null
  )

  const baseUrl = `${apiUrl.replace(/\/$/, "")}/documents/${documentId}`

  const loadVersions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${baseUrl}/versions`, {
        credentials: "include",
        headers: { "x-dev-user-id": userId },
      })
      if (!response.ok) throw new Error("加载版本历史失败")
      const items = (await response.json()) as DocumentVersion[]
      setVersions(items)
    } catch (error) {
      toastError(error, "加载版本历史失败")
    } finally {
      setLoading(false)
    }
  }, [baseUrl, userId])

  useEffect(() => {
    if (open) void loadVersions()
  }, [loadVersions, open])

  async function saveVersion() {
    setSaving(true)
    try {
      const response = await fetch(`${baseUrl}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "x-dev-user-id": userId },
      })
      if (!response.ok) throw new Error("保存版本失败")
      toast.success("已保存当前版本")
      await loadVersions()
    } catch (error) {
      toastError(error, "保存版本失败")
    } finally {
      setSaving(false)
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return
    try {
      const response = await fetch(
        `${baseUrl}/versions/${restoreTarget.id}/restore`,
        {
          method: "POST",
          credentials: "include",
          headers: { "x-dev-user-id": userId },
        }
      )
      if (!response.ok) throw new Error("恢复版本失败")
      toast.success("已恢复到选定版本，请刷新页面以同步内容")
      setRestoreTarget(null)
      onOpenChange(false)
      onRestored?.()
    } catch (error) {
      toastError(error, "恢复版本失败")
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[360px] sm:max-w-[360px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <PencilIcon icon={Clock3Icon} size={18} />
              版本历史
            </SheetTitle>
            <SheetDescription>
              基于协作快照保存的历史记录，可回滚到任意已保存版本。
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => void saveVersion()}
                className="self-start"
              >
                {saving ? "保存中…" : "保存当前版本"}
              </Button>
            ) : null}
            {loading ? (
              <p className="text-sm text-[#78746C]">加载中…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-[#78746C]">
                暂无历史版本。编辑后点击「保存当前版本」即可创建快照。
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {versions.map((version) => (
                  <li
                    key={version.id}
                    className="rounded-lg border border-[#E8E6E1] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#78746C]">
                          {formatVersionTime(version.createdAt)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-[#242321]">
                          {version.excerpt || "（空文档）"}
                        </p>
                      </div>
                      {canWrite ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setRestoreTarget(version)}
                        >
                          恢复
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRestoreTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复到此版本？</AlertDialogTitle>
            <AlertDialogDescription>
              恢复后当前未保存的协作内容将被覆盖，建议先保存当前版本再操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() => void confirmRestore()}
            >
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

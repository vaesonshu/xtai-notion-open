"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { useEffect, useState } from "react"
import { toast, toastError } from "@/lib/toast"
import { apiRequest } from "@/lib/api-client"
import { useAuthOptional } from "../auth-provider"

type PendingPublication = {
  id: string
  title: string
  updatedAt: string
}

export function PublicationApprovalQueue({
  apiUrl,
  onChanged,
}: {
  apiUrl: string
  onChanged?: () => void
}) {
  const auth = useAuthOptional()
  const userId = auth?.user?.id
  const [items, setItems] = useState<PendingPublication[]>([])
  const [target, setTarget] = useState<PendingPublication | null>(null)
  const [reason, setReason] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!apiUrl || !userId) return
    let cancelled = false
    void apiRequest({
      path: "/admin/publications",
      userId,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`无法加载待审批文章 (${response.status})`)
        return response.json() as Promise<PendingPublication[]>
      })
      .then((next) => {
        if (!cancelled) setItems(next)
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          toastError(nextError, "加载失败")
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiUrl, userId])

  async function decide(id: string, decision: "approve" | "reject") {
    if (!apiUrl || !userId) return
    if (decision === "reject" && !reason.trim()) {
      toast.error("请填写拒绝原因")
      return
    }
    setBusyId(id)
    try {
      const response = await apiRequest({
        path: `/admin/publications/${id}/${decision}`,
        method: "POST",
        userId,
        json: decision === "reject" ? { reason: reason.trim() } : undefined,
      })
      if (!response.ok) throw new Error(`审批失败 (${response.status})`)
      // Remove only after the server accepts the transition, preserving failed rows.
      setItems((current) => current.filter((item) => item.id !== id))
      setTarget(null)
      setReason("")
      toast.success(decision === "approve" ? "已通过发布" : "已拒绝发布")
      onChanged?.()
    } catch (nextError) {
      toastError(nextError, "审批失败")
    } finally {
      setBusyId(null)
    }
  }

  if (!userId) return null

  return (
    <section className="border border-[#e6ebe8] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#29463a]">待审批</h2>
        <span className="text-xs text-[#74857c]">{items.length} 篇</span>
      </div>
      {!items.length ? (
        <p className="py-4 text-center text-xs text-[#74857c]">
          暂无待审批文章
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 border-t pt-2 first:border-t-0 first:pt-0"
            >
              <div>
                <p className="text-sm font-medium text-[#29463a]">
                  {item.title}
                </p>
                <p className="text-xs text-[#74857c]">{item.updatedAt}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item.id, "approve")}
                >
                  通过
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => setTarget(item)}
                >
                  拒绝
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝发布</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="填写拒绝原因"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button
              disabled={!target || busyId === target.id}
              onClick={() => target && void decide(target.id, "reject")}
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

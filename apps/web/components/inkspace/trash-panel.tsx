"use client"

import { FileTextIcon, RotateCcwIcon } from "@workspace/icons"
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
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"
import { PencilIcon } from "./icon"

type TrashedDocument = {
  id: string
  title: string
}

/** 回收站视图：独立于侧边栏个人文档，在主内容区展示已删除文档 */
export function TrashPanel({
  documents,
  onRestore,
  onPurge,
}: {
  documents: readonly TrashedDocument[]
  onRestore?: (id: string) => void
  onPurge?: (id: string) => void
}) {
  const [purgeTarget, setPurgeTarget] = useState<TrashedDocument | null>(null)

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="trash-panel"
    >
      <header className="flex h-[68px] shrink-0 items-center gap-2 border-b border-[#E8E6E1] px-6">
        <PencilIcon icon={RotateCcwIcon} size={18} color="#78746C" />
        <h1 className="text-[15px] font-semibold text-[#242321]">回收站</h1>
        <span className="text-[13px] text-[#78746C]">{documents.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8">
        {documents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <PencilIcon icon={RotateCcwIcon} size={32} color="#D4D1CB" />
            <p className="text-sm font-medium text-[#242321]">回收站为空</p>
            <p className="max-w-sm text-sm text-[#78746C]">
              删除的文档会出现在这里，可恢复或永久删除。
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex w-full max-w-[720px] flex-col gap-1">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center gap-2 rounded-lg px-3 py-1 hover:bg-[#F3F2EF]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5 !text-[#78746C]">
                  <PencilIcon icon={FileTextIcon} color="#78746C" />
                  <span className="truncate text-[14px]">{document.title}</span>
                </div>
                {/* 回收站操作需始终可见，避免 hover 菜单在触屏/主区域里难以发现 */}
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-[13px] text-[#24866B] hover:!bg-[#E6F3EC]"
                    onClick={() => onRestore?.(document.id)}
                  >
                    恢复
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-[13px] text-[#DC2626] hover:!bg-[#FEE2E2]"
                    onClick={() => setPurgeTarget(document)}
                  >
                    永久删除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPurgeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除？</AlertDialogTitle>
            <AlertDialogDescription>
              “{purgeTarget?.title}”将被永久删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                if (purgeTarget) onPurge?.(purgeTarget.id)
                setPurgeTarget(null)
              }}
            >
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

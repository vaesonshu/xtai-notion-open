"use client"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useCollaborationStatus } from "../react/use-collaboration-status"

export function CollaborationStatus() {
  const status = useCollaborationStatus()

  if (status === "connecting") {
    return (
      <div role="status" aria-label="连接中" className="flex items-center gap-2">
        <Skeleton className="h-5 w-24" />
        <span className="sr-only">连接中</span>
      </div>
    )
  }

  if (status === "synced") {
    return (
      <div role="status" aria-label="已同步" className="flex items-center gap-2">
        <Badge variant="secondary">已同步</Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="text-xs text-muted-foreground">已保存</span>} />
            <TooltipContent>文档更改已同步到服务器</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  if (status === "offline") {
    return (
      <div role="status" aria-label="离线">
        <Alert>
          <AlertTitle>离线</AlertTitle>
          <AlertDescription>网络已断开，正在尝试重新连接。</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (status === "unauthorized") {
    return (
      <div role="status" aria-label="无权限">
        <Alert variant="destructive">
          <AlertTitle>无权限</AlertTitle>
          <AlertDescription>你没有访问此文档的权限。</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div role="status" aria-label="同步错误">
      <Alert variant="destructive">
        <AlertTitle>同步错误</AlertTitle>
        <AlertDescription>文档更新无法持久化，请稍后重试。</AlertDescription>
      </Alert>
    </div>
  )
}

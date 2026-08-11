"use client"

import type { CollaborationStatus } from "@workspace/editor/collaboration"
import {
  ChevronDownIcon,
  CloudCheckIcon,
  EllipsisIcon,
  FileTextIcon,
  MessageSquareIcon,
  SendIcon,
  UsersIcon,
} from "@workspace/icons"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { useCollaborationStatus } from "@workspace/editor/react"
import { PencilIcon } from "./icon"

export type EditorToolbarProps = {
  /** When omitted, status is read from CollaborationEditorProvider when available. */
  title?: string
  parentTitle?: string
}

function StatusBadge({ status }: { status: CollaborationStatus }) {
  if (status === "synced") {
    return (
      <Badge
        role="status"
        aria-label="已同步"
        variant="secondary"
        className="ml-1 gap-1 !bg-[#EEF8F4] px-2 py-1 text-[11px] font-medium !text-[#24866B]"
      >
        <PencilIcon icon={CloudCheckIcon} color="#24866B" size={13} />
        已保存
      </Badge>
    )
  }

  if (status === "connecting") {
    return (
      <Badge
        role="status"
        aria-label="连接中"
        variant="secondary"
        className="ml-1 px-2 py-1 text-[11px] font-medium"
      >
        连接中
      </Badge>
    )
  }

  if (status === "offline") {
    return (
      <Badge
        role="status"
        aria-label="离线"
        variant="secondary"
        className="ml-1 !bg-[#FFF4E5] px-2 py-1 text-[11px] font-medium !text-[#9A6700]"
      >
        离线
      </Badge>
    )
  }

  if (status === "unauthorized") {
    return (
      <Badge
        role="status"
        aria-label="无权限"
        variant="secondary"
        className="ml-1 !bg-[#FDECEC] px-2 py-1 text-[11px] font-medium !text-[#B53B30]"
      >
        无权限
      </Badge>
    )
  }

  return (
    <Badge
      role="status"
      aria-label="同步错误"
      variant="secondary"
      className="ml-1 !bg-[#FDECEC] px-2 py-1 text-[11px] font-medium !text-[#B53B30]"
    >
      同步错误
    </Badge>
  )
}

function CollaborationToolbarBadge() {
  const status = useCollaborationStatus()
  return <StatusBadge status={status} />
}

export function EditorToolbar({
  title = "新一代知识工作台",
  parentTitle,
}: EditorToolbarProps) {
  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#E8E6E1] px-6">
      <div className="flex items-center gap-[7px] text-[13px] !text-[#242321]">
        <PencilIcon icon={FileTextIcon} size={18} />
        <span className="font-medium text-[#78746C]">
          {parentTitle ?? "产品团队"}
        </span>
        <PencilIcon icon={ChevronDownIcon} color="#B5B1AA" size={14} />
        <span className="font-semibold !text-[#242321]">{title}</span>
        <CollaborationToolbarBadge />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#5E625D]">
          <span className="size-[7px] rounded-full bg-[#2FA778]" />
          协作中
        </span>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="!text-[#615E58] hover:!bg-[#F3F2EF] hover:!text-[#615E58]"
        >
          <PencilIcon icon={MessageSquareIcon} size={17} color="#615E58" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="!text-[#615E58] hover:!bg-[#F3F2EF] hover:!text-[#615E58]"
        >
          <PencilIcon icon={EllipsisIcon} size={17} color="#615E58" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="!text-[#373532] hover:!border-[#CFCBC4] hover:!bg-[#F3F2EF] hover:!text-[#373532]"
        >
          <PencilIcon icon={UsersIcon} color="#4F4C47" />
          分享
        </Button>
        <Button
          size="sm"
          className="!bg-[#E64B3C] !text-white hover:!bg-[#D94335] hover:!text-white"
        >
          <PencilIcon icon={SendIcon} color="white" />
          发布
        </Button>
        <Avatar className="size-8 bg-[#242321] hover:bg-[#242321]">
          <AvatarFallback className="bg-[#242321] !text-white">
            林
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

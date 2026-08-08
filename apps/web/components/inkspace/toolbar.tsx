import {
  ChevronDown,
  CloudCheck,
  Ellipsis,
  FileText,
  MessageSquare,
  Send,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { PencilIcon } from "./icon"
export function EditorToolbar() {
  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#E8E6E1] px-6">
      <div className="flex items-center gap-[7px] text-[13px] !text-[#242321]">
        <PencilIcon icon={FileText} size={18} />
        <span className="font-medium text-[#78746C]">产品团队</span>
        <PencilIcon icon={ChevronDown} color="#B5B1AA" size={14} />
        <span className="font-semibold !text-[#242321]">新一代知识工作台</span>
        <Badge
          variant="secondary"
          className="ml-1 gap-1 !bg-[#EEF8F4] px-2 py-1 text-[11px] font-medium !text-[#24866B]"
        >
          <PencilIcon icon={CloudCheck} color="#24866B" size={13} />
          已保存
        </Badge>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#5E625D]">
          <span className="size-[7px] rounded-full bg-[#2FA778]" />3 人在线
        </span>
        <div className="flex w-[98px]">
          {["周", "陈", "许", "+2"].map((x, i) => (
            <Avatar
              key={x}
              className={`-ml-2 size-[30px] border-2 border-[#FCFCFA] first:ml-0 ${i === 0 ? "bg-[#DCE9F8]" : i === 1 ? "bg-[#F6E3D6]" : i === 2 ? "bg-[#E5DDF4]" : "bg-[#F1F0EC]"}`}
            >
              <AvatarFallback className="bg-transparent text-[11px] font-semibold !text-[#383A37]">
                {x}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="!text-[#615E58] hover:!bg-[#F3F2EF] hover:!text-[#615E58]"
        >
          <PencilIcon icon={MessageSquare} size={17} color="#615E58" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="!text-[#615E58] hover:!bg-[#F3F2EF] hover:!text-[#615E58]"
        >
          <PencilIcon icon={Ellipsis} size={17} color="#615E58" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="!text-[#373532] hover:!border-[#CFCBC4] hover:!bg-[#F3F2EF] hover:!text-[#373532]"
        >
          <PencilIcon icon={Users} color="#4F4C47" />
          分享
        </Button>
        <Button
          size="sm"
          className="!bg-[#E64B3C] !text-white hover:!bg-[#D94335] hover:!text-white"
        >
          <PencilIcon icon={Send} color="white" />
          发布
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="!text-[#373532] hover:!bg-[#F3F2EF] hover:!text-[#373532]"
        >
          登录
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

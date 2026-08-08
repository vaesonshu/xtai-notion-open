import {
  ChevronDown,
  ChevronsUpDown,
  FileText,
  Folder,
  FolderOpen,
  Info,
  Library,
  Plus,
  Search,
  Star,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { PencilIcon } from "./icon"

const docs = [
  ["产品与设计", FolderOpen, true],
  ["研究档案", Folder, false],
  ["增长实验", Folder, false],
  ["品牌资产", Folder, false],
] as const
const personal = [
  ["今日随笔", FileText, false],
  ["阅读清单", FileText, false],
] as const

export function WorkspaceSidebar() {
  return (
    <aside
      className="hidden shrink-0 flex-col gap-[18px] border-r bg-white px-3 py-4 lg:flex"
      style={{ width: 280 }}
    >
      <div className="flex h-[246px] flex-col gap-[10px] rounded-xl bg-[#FCFCFB] px-2 pt-2 pb-3">
        <div className="flex h-[60px] items-center gap-[10px] px-1 py-2">
          <Avatar className="size-[34px] rounded-[10px] bg-[#242321]">
            <AvatarFallback className="rounded-[10px] bg-[#242321] text-white">
              L
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">栖木工作室</span>
            <span className="text-[10px] font-semibold tracking-[0.4px] text-[#78746C]">
              PRO · 6 位成员
            </span>
          </div>
          <PencilIcon icon={ChevronsUpDown} />
        </div>
        <div className="flex flex-col gap-[3px]">
          <SideAction icon={Search} label="搜索" shortcut="⌘ K" />
          <SideAction icon={Plus} label="新建文档" shortcut="N" active />
          <SideAction icon={Library} label="新建知识库" />
        </div>
        <SideAction icon={Star} label="收藏" shortcut="3" selected />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 bg-white">
        <SideSection title="协作文档" count="6" items={docs} />
        <SideSection title="个人文档" count="4" items={personal} />
      </div>
      <Separator />
      <div className="flex flex-col gap-[10px] px-1 pt-[10px]">
        <div className="flex items-center gap-2 text-[11px] text-[#78746C]">
          <span className="size-[7px] rounded-full bg-[#22C55E]" />
          所有更改已同步
          <span className="flex-1" />
          <PencilIcon icon={Info} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-semibold text-[#78746C]">
            <span>知识容量</span>
            <span className="text-[#24866B]">62%</span>
          </div>
          <div className="h-1 rounded bg-[#DFE1DC]">
            <div className="h-1 w-[62%] rounded bg-[#24866B]" />
          </div>
        </div>
      </div>
    </aside>
  )
}
function SideAction({
  icon,
  label,
  shortcut,
  active,
  selected,
}: {
  icon: typeof Search
  label: string
  shortcut?: string
  active?: boolean
  selected?: boolean
}) {
  return (
    <Button
      variant="ghost"
      className={`h-[34px] !justify-start gap-2.5 rounded-[7px] px-[9px] ${active ? "!bg-[#E6F3EC] !text-[#24866B] hover:!bg-[#DDEFE5] hover:!text-[#24866B]" : selected ? "!bg-[#EEF0EC] !text-[#24866B] hover:!bg-[#E4E8E2] hover:!text-[#24866B]" : "!text-[#242321] hover:!bg-[#F3F2EF] hover:!text-[#242321]"}`}
    >
      <PencilIcon
        icon={icon}
        color={active || selected ? "#24866B" : "#78746C"}
      />
      <span className="text-[13px] font-medium">{label}</span>
      <span className="flex-1" />
      {shortcut && (
        <span className="text-[10px] text-[#78746C]">{shortcut}</span>
      )}
    </Button>
  )
}
function SideSection({
  title,
  count,
  items,
}: {
  title: string
  count: string
  items: readonly (readonly [string, typeof Folder, boolean])[]
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-6 items-center gap-1.5 px-[7px] text-[11px] font-semibold tracking-[0.3px] text-[#78746C]">
        <PencilIcon icon={ChevronDown} size={12} />
        <span>{title}</span>
        <span className="flex-1" />
        <span className="font-normal">{count}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map(([label, Component, active]) => (
          <Button
            key={label}
            variant="ghost"
            className={`h-8 !justify-start gap-[9px] rounded-[7px] px-2 ${active ? "!bg-[#E6F3EC] !text-[#24866B] hover:!bg-[#DDEFE5] hover:!text-[#24866B]" : "!text-[#242321] hover:!bg-[#F3F2EF] hover:!text-[#242321]"}`}
          >
            <PencilIcon
              icon={Component}
              color={active ? "#24866B" : "#78746C"}
            />
            <span
              className={`text-[13px] ${active ? "font-semibold !text-[#24866B]" : "font-normal !text-[#242321]"}`}
            >
              {label}
            </span>
            <span className="flex-1" />
            {label === "研究档案" && (
              <span className="size-[18px] rounded-full border-2 border-white bg-[#8B5CF6]" />
            )}
          </Button>
        ))}
      </div>
    </div>
  )
}

import {
  FileTextIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  UsersIcon,
} from "@workspace/icons"

const navigation = [
  // Match the source node's icon choice rather than substituting a similar glyph.
  { label: "概览", icon: LayoutDashboardIcon },
  { label: "用户管理", icon: UsersIcon },
  { label: "文章管理", icon: FileTextIcon, active: true },
  { label: "分类管理", icon: FolderTreeIcon },
  { label: "评论审核", icon: MessageSquareIcon },
]

export function AdminSidebar() {
  return (
    <aside className="flex h-[900px] w-[236px] shrink-0 flex-col gap-[22px] border-r border-[#e5e9e6] bg-white px-4 py-6">
      <div className="flex flex-col gap-[5px]">
        <p className="text-[15px] font-bold text-[#173d31]">Inkspace Admin</p>
        <p className="text-[9px] font-semibold tracking-[1.3px] text-[#78a391]">
          CONTENT OPERATIONS
        </p>
      </div>
      <nav aria-label="后台导航" className="space-y-[6px]">
        {navigation.map(({ label, icon: Icon, active }) => (
          <a
            key={label}
            href={active ? "/admin/articles" : "#"}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center gap-2.5 rounded-[7px] px-2.5 text-[13px] ${
              active
                ? "bg-[#e6f1ea] font-semibold text-[#145e45]"
                : "font-normal text-[#42534b]"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </a>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#d8eee3] text-[12px] font-bold text-[#167251]">
          林
        </span>
        <div className="text-[12px] text-[#42534b]">
          <p className="font-semibold">林默</p>
          <p className="mt-0.5 text-[10px] text-[#87968e]">管理员</p>
        </div>
      </div>
    </aside>
  )
}

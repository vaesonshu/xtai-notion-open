import { FileTextIcon, SearchIcon, UsersIcon } from "@workspace/icons"

const navigation = [
  { label: "概览", icon: SearchIcon },
  { label: "文章管理", icon: FileTextIcon, active: true },
  { label: "用户管理", icon: UsersIcon },
]

export function AdminSidebar() {
  return (
    <aside className="hidden w-[196px] shrink-0 border-r border-[#e8ece9] bg-white px-4 py-5 md:flex md:flex-col">
      <div className="mb-8">
        <p className="text-[12px] font-semibold tracking-[-0.01em] text-[#237c62]">
          Inkspace Admin
        </p>
        <p className="mt-1 text-[10px] text-[#94a19a]">内容运营后台</p>
      </div>
      <nav aria-label="后台导航" className="space-y-1">
        {navigation.map(({ label, icon: Icon, active }) => (
          <a
            key={label}
            href={active ? "/admin/articles" : "#"}
            aria-current={active ? "page" : undefined}
            className={`flex h-8 items-center gap-2 rounded-md px-2 text-[11px] transition-colors ${
              active
                ? "bg-[#e6f3ec] font-medium text-[#237c62]"
                : "text-[#738077] hover:bg-[#f5f7f5] hover:text-[#3e4b43]"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </a>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2 text-[10px] text-[#95a199]">
        <span className="size-1.5 rounded-full bg-[#61b891]" />
        系统正常
      </div>
    </aside>
  )
}

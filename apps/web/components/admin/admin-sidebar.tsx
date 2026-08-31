"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FileTextIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  UsersIcon,
} from "@workspace/icons"
import { useAuth } from "../auth-provider"

const navigation = [
  { label: "概览", href: "#", icon: LayoutDashboardIcon, disabled: true },
  { label: "用户管理", href: "/admin/users", icon: UsersIcon },
  { label: "文章管理", href: "/admin/articles", icon: FileTextIcon },
  { label: "分类管理", href: "#", icon: FolderTreeIcon, disabled: true },
  { label: "评论审核", href: "#", icon: MessageSquareIcon, disabled: true },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const displayName = auth.user?.name ?? "管理员"
  const initial = displayName.slice(0, 1)

  return (
    <aside className="flex h-svh w-[236px] shrink-0 flex-col gap-[22px] border-r border-[#e5e9e6] bg-white px-4 py-6">
      <div className="flex flex-col gap-[5px]">
        <p className="text-[15px] font-bold text-[#173d31]">Inkspace Admin</p>
        <p className="text-[9px] font-semibold tracking-[1.3px] text-[#78a391]">
          CONTENT OPERATIONS
        </p>
      </div>
      <nav aria-label="后台导航" className="space-y-[6px]">
        {navigation.map(({ label, href, icon: Icon, disabled }) => {
          const active =
            !disabled &&
            pathname != null &&
            (pathname === href || pathname.startsWith(`${href}/`))
          const className = `flex h-9 items-center gap-2.5 rounded-[7px] px-2.5 text-[13px] ${
            active
              ? "bg-[#e6f1ea] font-semibold text-[#145e45]"
              : disabled
                ? "cursor-not-allowed font-normal text-[#a8b5af]"
                : "font-normal text-[#42534b]"
          }`

          if (disabled) {
            return (
              <span key={label} className={className} aria-disabled="true">
                <Icon className="size-4" />
                {label}
              </span>
            )
          }

          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2">
        <span
          className="flex size-8 items-center justify-center rounded-full bg-[#d8eee3] text-[12px] font-bold text-[#167251]"
          style={
            auth.user?.color ? { backgroundColor: `${auth.user.color}22` } : {}
          }
        >
          {initial}
        </span>
        <div className="text-[12px] text-[#42534b]">
          <p className="font-semibold">{displayName}</p>
          <p className="mt-0.5 text-[10px] text-[#87968e]">管理员</p>
        </div>
      </div>
    </aside>
  )
}

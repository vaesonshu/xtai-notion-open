import type { ReactNode } from "react"

import { AdminSidebar } from "./admin-sidebar"

/** 后台通用外壳：占满视口，右侧内容区随窗口宽度伸展。 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex h-svh w-full overflow-hidden bg-[#f8faf8] font-[Inter,system-ui,sans-serif] text-[#242522]">
      <AdminSidebar />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden p-[28px_34px]">
        {children}
      </section>
    </main>
  )
}

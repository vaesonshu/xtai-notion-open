"use client"

import { AuthProvider } from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/lib/toast"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        {/* 全局 Sonner 容器；业务代码通过 toast() / toastError() 触发提示 */}
        <Toaster richColors closeButton position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  )
}

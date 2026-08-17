import "@workspace/ui/globals.css"
import "@workspace/editor/styles.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@workspace/ui/components/sonner"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="antialiased">
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          {/* 全局 Sonner 提示，供各页面通过 toast() 调用 */}
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}

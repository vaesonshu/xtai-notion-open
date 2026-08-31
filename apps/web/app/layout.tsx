import "@workspace/ui/globals.css"
import "@xtai-notion/editor-shadcn/style.css"
import { AppProviders } from "@/components/app-providers"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="antialiased">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}

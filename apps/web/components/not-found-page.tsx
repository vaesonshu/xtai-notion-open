import { ArrowLeftIcon, FileTextIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import Link from "next/link"

export type NotFoundPageProps = {
  /** 自定义标题，默认「页面未找到」 */
  title?: string
  /** 自定义描述文案 */
  description?: string
  /** 返回链接地址，默认 `/documents` */
  homeHref?: string
  /** 返回按钮文案，默认「返回工作区」 */
  homeLabel?: string
}

// 全站复用的 404 展示组件，可在 not-found 路由或业务页中直接引用
export function NotFoundPage({
  title = "页面未找到",
  description = "你访问的页面不存在，或已被移动、删除。",
  homeHref = "/documents",
  homeLabel = "返回工作区",
}: NotFoundPageProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <FileTextIcon className="size-6 text-muted-foreground" />
            </div>
            <p className="text-5xl font-semibold tracking-tight text-foreground">
              404
            </p>
            <CardTitle className="mt-2">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          <CardFooter className="flex-col gap-3">
            <Button
              size="lg"
              render={<Link href={homeHref} />}
              nativeButton={false}
              className="w-full"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              {homeLabel}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

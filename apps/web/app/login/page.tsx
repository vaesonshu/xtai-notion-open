"use client"

import {
  AlertCircleIcon,
  ArrowLeftIcon,
  LockKeyholeIcon,
  MailIcon,
} from "@workspace/icons"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { useAuth } from "../../components/auth-provider"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function getSafeReturnTo(value: string | null) {
  // Authentication redirects stay inside this application even if the query
  // string was supplied by an untrusted external link.
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/documents"
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh: refreshAuth } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"))
  const registerHref = `/register?returnTo=${encodeURIComponent(returnTo)}`
  const registered = searchParams.get("registered") === "1"

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Use the same-origin auth proxy so the login response and `/auth/me`
      // share one browser cookie even when the API uses 127.0.0.1 locally.
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(body?.message || `登录失败 (${response.status})`)
      }

      // Refresh the shared auth state before navigation so the destination
      // renders authenticated controls without a stale logged-out frame.
      await refreshAuth()
      router.push(returnTo)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "登录失败，请稍后重试"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/" />}
          nativeButton={false}
          className="self-start"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          返回工作区
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>继续进入你的协作文档工作区</CardDescription>
          </CardHeader>

          <CardContent>
            <form id="login-form" onSubmit={submit}>
              <FieldGroup>
                {registered ? (
                  <Alert>
                    <AlertDescription>
                      账号创建成功，请使用新账号登录。
                    </AlertDescription>
                  </Alert>
                ) : null}

                {error ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="email">
                    <MailIcon className="size-4" />
                    邮箱
                  </FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={loading}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">
                    <LockKeyholeIcon className="size-4" />
                    密码
                  </FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    required
                  />
                </Field>
              </FieldGroup>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-3">
            <Button
              type="submit"
              form="login-form"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading ? <Spinner data-icon="inline-start" /> : null}
              {loading ? "登录中..." : "登录"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link
                href={registerHref}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                创建账号
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

export default function LoginPage() {
  // Next 16 requires client-side search parameter access below Suspense so the
  // route can retain a static shell during production prerendering.
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-muted/40">
          <Spinner />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

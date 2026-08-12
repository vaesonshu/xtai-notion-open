"use client"

import {
  AlertCircleIcon,
  ArrowLeftIcon,
  LockKeyholeIcon,
  MailIcon,
  UserRoundIcon,
  UserRoundPlusIcon,
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function getSafeReturnTo(value: string | null) {
  // Keep the eventual post-login destination internal when registration was
  // opened from a query string controlled by the browser address bar.
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/documents"
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"))
  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== passwordConfirmation) {
      setError("两次输入的密码不一致")
      return
    }

    setLoading(true)
    try {
      // Registration uses the same auth proxy as login to keep all account
      // requests independent of the API server's local hostname.
      const response = await fetch("/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim(),
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(body?.message || `注册失败 (${response.status})`)
      }

      // Registration does not create a session, so send the new user to login
      // and preserve the page they originally intended to visit.
      const params = new URLSearchParams({ registered: "1", returnTo })
      router.push(`/login?${params.toString()}`)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "注册失败，请稍后重试"
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
          render={<Link href={loginHref} />}
          nativeButton={false}
          className="self-start"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          返回登录
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>创建账号</CardTitle>
            <CardDescription>注册后即可进入协作文档工作区</CardDescription>
          </CardHeader>

          <CardContent>
            <form id="register-form" onSubmit={submit}>
              <FieldGroup>
                {error ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="display-name">
                    <UserRoundIcon className="size-4" />
                    昵称
                  </FieldLabel>
                  <Input
                    id="display-name"
                    name="displayName"
                    autoComplete="name"
                    placeholder="你希望显示的名字"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={loading}
                    required
                  />
                </Field>

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
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    required
                  />
                  <FieldDescription>至少 8 个字符</FieldDescription>
                </Field>

                <Field
                  data-invalid={Boolean(
                    error && password !== passwordConfirmation
                  )}
                >
                  <FieldLabel htmlFor="password-confirmation">
                    <LockKeyholeIcon className="size-4" />
                    确认密码
                  </FieldLabel>
                  <Input
                    id="password-confirmation"
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={passwordConfirmation}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    disabled={loading}
                    aria-invalid={Boolean(
                      error && password !== passwordConfirmation
                    )}
                    required
                  />
                </Field>
              </FieldGroup>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-3">
            <Button
              type="submit"
              form="register-form"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UserRoundPlusIcon data-icon="inline-start" />
              )}
              {loading ? "创建中..." : "创建账号"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              已有账号？{" "}
              <Link
                href={loginHref}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                返回登录
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  // Keep useSearchParams inside Suspense as required by Next 16 production
  // prerendering while still providing a stable full-height loading shell.
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-muted/40">
          <Spinner />
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}

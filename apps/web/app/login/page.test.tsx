import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import LoginPage from "./page"

const push = vi.fn()
const refresh = vi.fn()
const refreshAuth = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams("returnTo=%2Fdocuments%2Fdemo"),
}))

vi.mock("../../components/auth-provider", () => ({
  useAuth: () => ({ refresh: refreshAuth }),
}))

describe("LoginPage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
    refresh.mockReset()
    refreshAuth.mockReset()
  })

  it("uses workspace form components and links to registration", () => {
    render(<LoginPage />)

    // Shared UI components expose data-slot attributes that keep auth forms
    // aligned with the workspace design system.
    expect(screen.getByRole("button", { name: "登录" })).toHaveAttribute(
      "data-slot",
      "button"
    )
    expect(screen.getByLabelText("邮箱")).toHaveAttribute("data-slot", "input")
    expect(screen.getByRole("link", { name: "创建账号" })).toHaveAttribute(
      "href",
      "/register?returnTo=%2Fdocuments%2Fdemo"
    )
  })

  it("refreshes the session and returns to the requested page after login", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "member@example.com" },
    })
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "登录" }))

    await waitFor(() => expect(refreshAuth).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          email: "member@example.com",
          password: "password123",
        }),
      })
    )
    expect(push).toHaveBeenCalledWith("/documents/demo")
    // Navigation already follows the refreshed auth context; refreshing here
    // can reload `/login` before Next commits the destination route.
    expect(refresh).not.toHaveBeenCalled()
  })
})

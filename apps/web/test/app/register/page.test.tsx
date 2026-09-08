import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "@/lib/toast"
import RegisterPage from "@/app/register/page"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("returnTo=%2Fdocuments%2Fdemo"),
}))

describe("RegisterPage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
  })

  it("submits a new account and preserves the return destination", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 201 }))
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText("昵称"), {
      target: { value: "林墨" },
    })
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "new@example.com" },
    })
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    })
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "password123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/register",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          email: "new@example.com",
          password: "password123",
          displayName: "林墨",
        }),
      })
    )
    expect(push).toHaveBeenCalledWith("/login?returnTo=%2Fdocuments%2Fdemo")
    expect(toast.success).toHaveBeenCalledWith(
      "账号创建成功，请使用新账号登录。"
    )
  })

  it("shows a toast when password confirmation does not match", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText("昵称"), {
      target: { value: "林墨" },
    })
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "new@example.com" },
    })
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    })
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "different123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }))

    expect(toast.error).toHaveBeenCalledWith("两次输入的密码不一致")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows a toast when password is too short", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText("昵称"), {
      target: { value: "林墨" },
    })
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "new@example.com" },
    })
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "short" },
    })
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "short" },
    })
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }))

    expect(toast.error).toHaveBeenCalledWith("密码至少需要 8 个字符")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

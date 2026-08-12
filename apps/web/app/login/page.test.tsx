import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import LoginPage from "./page"

const push = vi.fn()
const refresh = vi.fn()
const refreshAuth = vi.fn()
let returnTo = "/documents/demo"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () =>
    new URLSearchParams(`returnTo=${encodeURIComponent(returnTo)}`),
}))

vi.mock("../../components/auth-provider", () => ({
  useAuth: () => ({ refresh: refreshAuth }),
}))

describe("LoginPage", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    push.mockReset()
    refresh.mockReset()
    refreshAuth.mockReset()
    returnTo = "/documents/demo"
  })

  it("uses workspace form components and links to registration", () => {
    const { container } = render(<LoginPage />)

    // Stable data-slot and name attributes keep this test independent of UI translations.
    expect(container.querySelector('button[type="submit"]')).toHaveAttribute(
      "data-slot",
      "button"
    )
    expect(container.querySelector('input[name="email"]')).toHaveAttribute(
      "data-slot",
      "input"
    )
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/register?returnTo=%2Fdocuments%2Fdemo"
    )
  })

  async function submitLogin() {
    const { container } = render(<LoginPage />)
    fireEvent.change(container.querySelector('input[name="email"]')!, {
      target: { value: "member@example.com" },
    })
    fireEvent.change(container.querySelector('input[name="password"]')!, {
      target: { value: "password123" },
    })
    // Submit the form directly so this regression test is stable across translated labels.
    fireEvent.submit(container.querySelector("form#login-form")!)
    await waitFor(() => expect(refreshAuth).toHaveBeenCalledOnce())
    return container
  }

  it("refreshes the session and returns to the requested page after login", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))

    await submitLogin()

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
    // Navigation already follows the refreshed auth context; refreshing here can reload `/login`.
    expect(refresh).not.toHaveBeenCalled()
  })

  it("returns to a share link after login", async () => {
    returnTo = "/share/share-token"
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))

    await submitLogin()

    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({ method: "POST" })
    )
    expect(push).toHaveBeenCalledWith("/share/share-token")
  })
})

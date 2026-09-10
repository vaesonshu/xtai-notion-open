import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthMenu } from "@/components/auth-menu"

const refresh = vi.fn()

const mockAuth = {
  user: {
    id: "member-1",
    name: "Member",
    color: "#24866B",
    role: "user" as const,
  },
  loading: false,
  refresh,
}

vi.mock("@/components/auth-provider", () => ({
  useAuthOptional: () => mockAuth,
}))

describe("AuthMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    refresh.mockReset()
    mockAuth.user = {
      id: "member-1",
      name: "Member",
      color: "#24866B",
      role: "user",
    }
  })

  it("hides the admin console link for regular users", () => {
    render(<AuthMenu />)
    fireEvent.click(screen.getByRole("button", { name: "账户菜单" }))
    expect(screen.queryByText("控制台")).not.toBeInTheDocument()
  })

  it("shows the admin console link for administrators", () => {
    mockAuth.user = {
      id: "admin-1",
      name: "Admin",
      color: "#24866B",
      role: "admin",
    }

    render(<AuthMenu />)
    fireEvent.click(screen.getByRole("button", { name: "账户菜单" }))

    const consoleLink = screen.getByRole("menuitem", { name: "控制台" })
    expect(consoleLink).toHaveAttribute("href", "/admin/users")
  })

  it("replaces the current page with login after logout", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }))
    const assign = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign },
    })

    render(<AuthMenu />)
    fireEvent.click(screen.getByRole("button", { name: "账户菜单" }))
    fireEvent.click(screen.getByText("注销"))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" })
    )
    // Logging out must discard the protected route instead of returning home.
    expect(assign).toHaveBeenCalledWith("/login")
  })
})

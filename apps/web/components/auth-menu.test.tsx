import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthMenu } from "./auth-menu"

const refresh = vi.fn()

vi.mock("./auth-provider", () => ({
  useAuthOptional: () => ({
    user: { id: "member-1", name: "Member", color: "#24866B" },
    loading: false,
    refresh,
  }),
}))

describe("AuthMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    refresh.mockReset()
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
    fireEvent.click(screen.getByRole("button"))
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

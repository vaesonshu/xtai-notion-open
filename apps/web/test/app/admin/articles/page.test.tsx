import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import Page from "@/app/admin/articles/page"

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "admin-1", name: "Admin", role: "admin" },
    loading: false,
    refresh: vi.fn(),
  }),
  useAuthOptional: () => ({
    user: { id: "admin-1", name: "Admin", role: "admin" },
    loading: false,
    refresh: vi.fn(),
  }),
}))

describe("Admin articles route", () => {
  it("renders the article management heading", () => {
    render(<Page />)

    expect(
      screen.getByRole("heading", { name: "文章管理" })
    ).toBeInTheDocument()
  })
})

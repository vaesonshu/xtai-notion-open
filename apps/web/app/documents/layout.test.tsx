import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DocumentsLayout from "./layout"

const replace = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => "/documents/document-1",
  useRouter: () => ({ replace }),
}))

vi.mock("../../components/auth-provider", () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

describe("DocumentsLayout", () => {
  it("redirects unauthenticated document routes to login with their return path", () => {
    render(<DocumentsLayout>content</DocumentsLayout>)

    expect(replace).toHaveBeenCalledWith(
      "/login?returnTo=%2Fdocuments%2Fdocument-1"
    )
    expect(screen.getByLabelText("Loading")).toBeVisible()
  })
})

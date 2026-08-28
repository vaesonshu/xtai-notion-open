import { describe, expect, it, vi } from "vitest"
import Page from "@/app/page"

const redirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  })
)

vi.mock("next/navigation", () => ({ redirect }))

describe("home page", () => {
  it("redirects to the authenticated documents entry point", () => {
    expect(() => Page()).toThrow("NEXT_REDIRECT")
    expect(redirect).toHaveBeenCalledWith("/documents")
  })
})

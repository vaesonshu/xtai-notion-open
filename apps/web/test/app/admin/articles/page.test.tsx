import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Page from "@/app/admin/articles/page"

describe("Admin articles route", () => {
  it("renders the article management heading", () => {
    render(<Page />)

    expect(
      screen.getByRole("heading", { name: "文章管理" })
    ).toBeInTheDocument()
  })
})

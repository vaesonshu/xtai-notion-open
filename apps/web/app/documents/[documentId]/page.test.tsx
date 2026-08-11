import "@testing-library/jest-dom/vitest"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import DocumentPage from "./page"

describe("DocumentPage", () => {
  it("opens the document identified by the route parameter", async () => {
    const { container } = render(
      await DocumentPage({
        params: Promise.resolve({ documentId: "route-document" }),
      })
    )

    expect(container.firstElementChild).toHaveAttribute(
      "data-document-route",
      "route-document"
    )
  })
})

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { EditorDocument } from "@xtai-notion/editor-core"
import { ArticleReader } from "./article-reader"

vi.mock("../auth-provider", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    refresh: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
  )
})

const content: EditorDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "\u516c\u5f00\u9605\u8bfb\u6b63\u6587" }],
    },
  ],
}

const contentWithImage: EditorDocument = {
  type: "doc",
  content: [
    {
      type: "image",
      attrs: {
        src: "https://example.com/photo.jpg",
        alt: "\u793a\u4f8b\u56fe",
      },
    },
  ],
}

describe("ArticleReader", () => {
  it("renders article metadata and read-only body", () => {
    render(
      <ArticleReader
        article={{
          id: "doc-1",
          title: "Published guide",
          author: "Ada",
          authorColor: "#24866B",
          publishedAt: "2026-08-14T08:00:00.000Z",
          category: "\u4e2a\u4eba\u7a7a\u95f4",
          content,
        }}
      />
    )

    expect(
      screen.getByRole("heading", { name: "Published guide" })
    ).toBeInTheDocument()
    expect(screen.getByText("Ada")).toBeInTheDocument()
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("\u4e2a\u4eba\u7a7a\u95f4")).toBeInTheDocument()
    expect(screen.getByText("\u516c\u5f00\u9605\u8bfb\u6b63\u6587")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /\u8fd4\u56de\u5199\u4f5c\u5e7f\u573a/ })
    ).toHaveAttribute("href", "/square")
  })

  it("opens a lightbox when an inline image is clicked", () => {
    render(
      <ArticleReader
        article={{
          id: "doc-2",
          title: "Photo story",
          author: "Ada",
          authorColor: "#24866B",
          publishedAt: "2026-08-14T08:00:00.000Z",
          category: "\u4e2a\u4eba\u7a7a\u95f4",
          content: contentWithImage,
        }}
      />
    )

    fireEvent.click(screen.getByRole("img", { name: "\u793a\u4f8b\u56fe" }))

    expect(
      screen.getByRole("dialog", { name: "\u56fe\u7247\u9884\u89c8" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: "\u653e\u5927\u9884\u89c8" })
    ).toHaveAttribute("src", "https://example.com/photo.jpg")
  })
})

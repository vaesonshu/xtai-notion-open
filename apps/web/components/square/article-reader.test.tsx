import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { EditorDocument } from "@workspace/editor"
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
      content: [{ type: "text", text: "公开阅读正文" }],
    },
  ],
}

const contentWithImage: EditorDocument = {
  type: "doc",
  content: [
    {
      type: "image",
      attrs: { src: "https://example.com/photo.jpg", alt: "示例图" },
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
          category: "个人空间",
          content,
        }}
      />
    )

    expect(screen.getByRole("heading", { name: "Published guide" })).toBeInTheDocument()
    expect(screen.getByText("Ada")).toBeInTheDocument()
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("个人空间")).toBeInTheDocument()
    expect(screen.getByText("公开阅读正文")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "← 返回写作广场" })).toHaveAttribute(
      "href",
      "/square"
    )
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
          category: "个人空间",
          content: contentWithImage,
        }}
      />
    )

    fireEvent.click(screen.getByRole("img"))

    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "放大预览" })).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg"
    )
  })
})

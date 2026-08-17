import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ArticleComments } from "./article-comments"

vi.mock("../auth-provider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Ada", color: "#24866B" },
    loading: false,
    refresh: vi.fn(),
  }),
}))

const sampleTree = [
  {
    id: "c1",
    articleId: "doc-1",
    parentId: null,
    depth: 0,
    body: "写得真好 👍",
    authorId: "u2",
    authorName: "Bob",
    authorColor: "#111111",
    createdAt: "2026-08-14T08:00:00.000Z",
    replies: [
      {
        id: "c2",
        articleId: "doc-1",
        parentId: "c1",
        depth: 1,
        body: "同感",
        authorId: "u3",
        authorName: "Carol",
        authorColor: "#222222",
        createdAt: "2026-08-14T09:00:00.000Z",
        replies: [],
      },
    ],
  },
]

describe("ArticleComments", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleTree,
      })
    )
  })

  it("loads and renders nested comments", async () => {
    render(<ArticleComments articleId="doc-1" />)

    expect(await screen.findByText("写得真好 👍")).toBeInTheDocument()
    expect(screen.getByText("同感")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /评论/ })).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("写下你的想法，支持表情符号 😊")
    ).toBeInTheDocument()
  })
})

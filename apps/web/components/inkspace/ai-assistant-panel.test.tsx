import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AiAssistantPanel } from "./ai-assistant-panel"

function streamResponse(events: string[]) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event))
      controller.close()
    },
  })
  return { ok: true, body }
}

const props = {
  open: true,
  onClose: vi.fn(),
  apiUrl: "http://api",
  documentId: "doc-1",
  userId: "user-1",
  getDocumentText: vi.fn(() => "最新文档"),
}

describe("AiAssistantPanel", () => {
  it("sends the latest document snapshot and joins streamed tokens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'event: token\ndata: {"type":"token","content":"你好"}\n\n',
          'event: token\ndata: {"type":"token","content":"世界"}\n\n',
          'event: done\ndata: {"type":"done"}\n\n',
        ])
      )
    vi.stubGlobal("fetch", fetchMock)
    render(<AiAssistantPanel {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "总结文档" }))
    expect(screen.getByRole("status")).toHaveTextContent("正在思考")
    await waitFor(() =>
      expect(screen.getByText("你好世界")).toBeInTheDocument()
    )
    expect(props.getDocumentText).toHaveBeenCalled()
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    ).toMatchObject({ documentText: "最新文档" })
  })

  it("clears the conversation when closed and reopened", async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <AiAssistantPanel {...props} onClose={onClose} />
    )
    fireEvent.click(screen.getByRole("button", { name: "关闭 AI 面板" }))
    expect(onClose).toHaveBeenCalled()
    rerender(<AiAssistantPanel {...props} open={false} onClose={onClose} />)
    rerender(<AiAssistantPanel {...props} open />)
    expect(screen.getByRole("button", { name: "总结文档" })).toBeInTheDocument()
  })

  it("scrolls the message viewport to the newest streamed content", async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            'event: token\ndata: {"type":"token","content":"回复"}\n\n',
          ])
        )
    )
    render(<AiAssistantPanel {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /总结/ }))
    await waitFor(() => expect(screen.getByText("回复")).toBeInTheDocument())
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it("renders assistant Markdown while keeping raw HTML out of the DOM", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            'event: token\ndata: {"type":"token","content":"## 标题\\n\\n**重点** [链接](https://example.com)\\n\\n<script>alert(1)</script>"}\n\n',
          ])
        )
    )
    render(<AiAssistantPanel {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /总结/ }))
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "标题" })
      ).toBeInTheDocument()
    )
    expect(screen.getByText("重点")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "链接" })).toHaveAttribute(
      "target",
      "_blank"
    )
    expect(
      screen.queryByText("<script>alert(1)</script>")
    ).not.toBeInTheDocument()
    expect(document.querySelector("script")).toBeNull()
  })

  it("fills the workspace height so the composer stays at the panel bottom", () => {
    render(<AiAssistantPanel {...props} />)
    expect(screen.getByRole("complementary")).toHaveClass("h-full")
  })

  it("highlights fenced code blocks and preserves their language label", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            'event: token\ndata: {"type":"token","content":"```ts\\nconst answer: string = \\\"ok\\\"\\n```"}\n\n',
          ])
        )
    )
    render(<AiAssistantPanel {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /总结/ }))
    await waitFor(() =>
      expect(screen.getByTestId("ai-code-block")).toBeInTheDocument()
    )
    expect(screen.getByTestId("ai-code-language")).toHaveTextContent("ts")
    expect(screen.getByTestId("ai-code-block")).toHaveTextContent(
      "const answer"
    )
  })
})

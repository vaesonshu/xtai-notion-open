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
    await waitFor(() =>
      expect(screen.getByText("你好世界")).toBeInTheDocument()
    )
    expect(props.getDocumentText).toHaveBeenCalled()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject(
      { documentText: "最新文档" }
    )
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
})

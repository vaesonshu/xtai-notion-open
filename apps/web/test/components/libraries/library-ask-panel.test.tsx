import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LibraryAskPanel } from "@/components/libraries/library-ask-panel"

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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("LibraryAskPanel", () => {
  it("shows citation titles, pending count, and keeps [1] as literal text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([
          `event: citations\ndata: ${JSON.stringify({
            type: "citations",
            citations: [
              {
                index: 1,
                sourceId: "src-1",
                sourceTitle: "产品手册",
                heading: null,
                page: null,
                excerpt: "定价说明",
                similarity: 0.91,
              },
            ],
            pendingSourceCount: 2,
          })}\n\n`,
          'event: token\ndata: {"type":"token","content":"根据资料 [1] 可以得出结论"}\n\n',
          'event: done\ndata: {"type":"done"}\n\n',
        ])
      )
    )

    render(<LibraryAskPanel libraryId="lib-1" userId="user-1" />)
    fireEvent.change(screen.getByPlaceholderText("向资料库提问"), {
      target: { value: "定价是什么" },
    })
    fireEvent.click(screen.getByRole("button", { name: "提问" }))

    expect(await screen.findByText("产品手册")).toBeInTheDocument()
    expect(screen.getByText("2 个来源未参与本次回答")).toBeInTheDocument()
    expect(screen.getByText("根据资料 [1] 可以得出结论")).toBeInTheDocument()
  })

  it("shows the no-hit answer from the stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([
          `event: citations\ndata: ${JSON.stringify({
            type: "citations",
            citations: [],
            pendingSourceCount: 0,
          })}\n\n`,
          'event: token\ndata: {"type":"token","content":"资料库里没有找到相关内容。"}\n\n',
          'event: done\ndata: {"type":"done"}\n\n',
        ])
      )
    )

    render(<LibraryAskPanel libraryId="lib-1" userId="user-1" />)
    fireEvent.change(screen.getByPlaceholderText("向资料库提问"), {
      target: { value: "没有的内容" },
    })
    fireEvent.click(screen.getByRole("button", { name: "提问" }))

    await waitFor(() => {
      expect(screen.getByText("资料库里没有找到相关内容。")).toBeInTheDocument()
    })
  })
})

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AiWritePromptBar } from "@shadcn-src/components/ai/ai-write-prompt-bar"

const noop = () => {}

const baseProps = {
  onSubmit: vi.fn(),
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onStop: vi.fn(),
  presets: [
    { id: "polish", label: "润色", prompt: "请润色选中内容" },
  ],
}

describe("AiWritePromptBar", () => {
  it("renders input and presets in user-input status", () => {
    render(<AiWritePromptBar status="user-input" {...baseProps} />)

    expect(screen.getByTestId("ai-write-prompt-bar")).toBeInTheDocument()
    expect(screen.getByLabelText("AI 写作提示")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "润色" })).toBeInTheDocument()
  })

  it("calls onSubmit with typed prompt", () => {
    const onSubmit = vi.fn()
    render(
      <AiWritePromptBar
        status="user-input"
        {...baseProps}
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByLabelText("AI 写作提示"), {
      target: { value: "写一段介绍" },
    })
    fireEvent.click(screen.getByRole("button", { name: "生成" }))

    expect(onSubmit).toHaveBeenCalledWith("写一段介绍")
  })

  it("calls onStop while thinking", () => {
    const onStop = vi.fn()
    render(
      <AiWritePromptBar status="thinking" {...baseProps} onStop={onStop} />
    )

    fireEvent.click(screen.getByTestId("ai-write-stop"))
    expect(onStop).toHaveBeenCalled()
  })

  it("calls onAccept when reviewing", () => {
    const onAccept = vi.fn()
    render(
      <AiWritePromptBar
        status="user-reviewing"
        {...baseProps}
        onAccept={onAccept}
      />
    )

    fireEvent.click(screen.getByTestId("ai-write-accept"))
    expect(onAccept).toHaveBeenCalled()
  })

  it("calls onReject when reviewing", () => {
    const onReject = vi.fn()
    render(
      <AiWritePromptBar
        status="user-reviewing"
        {...baseProps}
        onReject={onReject}
      />
    )

    fireEvent.click(screen.getByTestId("ai-write-reject"))
    expect(onReject).toHaveBeenCalled()
  })

  it("shows error message and reject in error status", () => {
    const onReject = vi.fn()
    render(
      <AiWritePromptBar
        status="error"
        errorMessage="没有可应用的改动"
        {...baseProps}
        onReject={onReject}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("没有可应用的改动")
    fireEvent.click(screen.getByTestId("ai-write-reject"))
    expect(onReject).toHaveBeenCalled()
  })

  it("renders nothing when closed", () => {
    render(<AiWritePromptBar status="closed" {...baseProps} />)
    expect(screen.queryByTestId("ai-write-prompt-bar")).not.toBeInTheDocument()
  })
})

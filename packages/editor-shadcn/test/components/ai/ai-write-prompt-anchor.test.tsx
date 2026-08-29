import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AiWritePromptAnchor } from "@shadcn-src/components/ai/ai-write-prompt-anchor"

const PARA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function mockAnchorRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 40,
    left: 80,
    bottom: 60,
    right: 280,
    width: 200,
    height: 20,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect
}

function mountAnchor() {
  const anchor = document.createElement("div")
  anchor.setAttribute("data-node-type", "blockContainer")
  anchor.setAttribute("data-id", PARA_ID)
  document.body.appendChild(anchor)
  return anchor
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document
    .querySelectorAll('[data-node-type="blockContainer"]')
    .forEach((node) => node.remove())
})

describe("AiWritePromptAnchor", () => {
  it("positions the overlay using the anchor block rect", () => {
    const anchor = mountAnchor()
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(mockAnchorRect())

    render(
      <AiWritePromptAnchor anchorBlockId={PARA_ID}>
        <div data-testid="ai-write-prompt-bar">bar</div>
      </AiWritePromptAnchor>
    )

    const overlay = screen.getByTestId("ai-writing-overlay")
    expect(overlay.style.top).toBe("68px")
    expect(overlay.style.left).toBe("80px")
  })

  it("falls back to viewport bottom when the anchor is missing", () => {
    render(
      <AiWritePromptAnchor anchorBlockId={PARA_ID}>
        <div data-testid="ai-write-prompt-bar">bar</div>
      </AiWritePromptAnchor>
    )

    const overlay = screen.getByTestId("ai-writing-overlay")
    expect(overlay.style.bottom).toBe("32px")
    expect(overlay.style.left).toBe("50%")
  })

  it("subscribes to scroll and resize with passive listeners", () => {
    const addSpy = vi.spyOn(window, "addEventListener")

    render(
      <AiWritePromptAnchor anchorBlockId={PARA_ID}>
        <div data-testid="ai-write-prompt-bar">bar</div>
      </AiWritePromptAnchor>
    )

    expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function), {
      passive: true,
      capture: true,
    })
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function), {
      passive: true,
    })
  })

  it("remeasures when the anchor block resizes", () => {
    let observerCallback: ResizeObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observerCallback = callback
        }
        observe = observe
        unobserve() {}
        disconnect = disconnect
      }
    )

    const anchor = mountAnchor()
    const rectSpy = vi.spyOn(anchor, "getBoundingClientRect")
    rectSpy.mockReturnValue(mockAnchorRect())

    const { unmount } = render(
      <AiWritePromptAnchor anchorBlockId={PARA_ID}>
        <div data-testid="ai-write-prompt-bar">bar</div>
      </AiWritePromptAnchor>
    )

    expect(observe).toHaveBeenCalledWith(anchor)
    expect(screen.getByTestId("ai-writing-overlay").style.top).toBe("68px")

    rectSpy.mockReturnValue(mockAnchorRect({ bottom: 120, height: 80 }))
    act(() => {
      observerCallback?.([], {} as ResizeObserver)
    })

    expect(screen.getByTestId("ai-writing-overlay").style.top).toBe("128px")

    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it("does not use full-viewport inset positioning classes", () => {
    render(
      <AiWritePromptAnchor anchorBlockId={PARA_ID}>
        <div data-testid="ai-write-prompt-bar">bar</div>
      </AiWritePromptAnchor>
    )

    const overlay = screen.getByTestId("ai-writing-overlay")
    expect(overlay.className).not.toMatch(/\binset-x-0\b/)
    expect(overlay.className).not.toMatch(/\bbottom-8\b/)
  })
})

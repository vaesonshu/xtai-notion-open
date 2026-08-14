import "@testing-library/jest-dom/vitest"

import { render } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const setTheme = vi.fn()

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ resolvedTheme: "light", setTheme }),
}))

import { ThemeProvider } from "./theme-provider"

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("ThemeProvider hotkey handling", () => {
  it("ignores keydown events that do not expose a key string", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener")

    render(<ThemeProvider />)

    const listener = addEventListenerSpy.mock.calls.find(
      ([type]) => type === "keydown"
    )?.[1]

    expect(listener).toBeTypeOf("function")

    // The regression reproduces with a keyboard-like event whose `key` value is
    // missing, so the handler must bail out before attempting normalization.
    expect(() => {
      ;(listener as (event: KeyboardEvent) => void)({
        altKey: false,
        ctrlKey: false,
        defaultPrevented: false,
        key: undefined,
        metaKey: false,
        repeat: false,
        target: document.body,
      } as unknown as KeyboardEvent)
    }).not.toThrow()

    expect(setTheme).not.toHaveBeenCalled()
  })
})

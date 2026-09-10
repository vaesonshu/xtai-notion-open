import { afterEach, describe, expect, it } from "vitest"
import { getDesktopBridge, isDesktopClient } from "@/lib/desktop-bridge"

afterEach(() => {
  delete window.electronDesktop
})

describe("getDesktopBridge", () => {
  it("returns null in a normal browser", () => {
    expect(getDesktopBridge()).toBeNull()
  })

  it("returns the API when Electron injected it", () => {
    window.electronDesktop = {
      isDesktop: true,
      notify: async () => true,
      retryLoad: async () => undefined,
    }
    expect(getDesktopBridge()?.isDesktop).toBe(true)
    expect(isDesktopClient()).toBe(true)
  })
})

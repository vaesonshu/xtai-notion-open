import { describe, expect, it, vi } from "vitest"
import {
  isInlineEditorLink,
  openEditorHref,
  resolveProseMirrorLink,
} from "@shadcn-src/components/editor/open-editor-href"

describe("openEditorHref", () => {
  it("uses navigate for internal paths", () => {
    const navigate = vi.fn()
    openEditorHref("/documents/doc-1", navigate)
    expect(navigate).toHaveBeenCalledWith("/documents/doc-1")
  })

  it("opens external links in a new tab", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    openEditorHref("https://example.com", undefined)
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer"
    )
    openSpy.mockRestore()
  })
})

describe("resolveProseMirrorLink", () => {
  it("returns anchors inside the editor surface", () => {
    document.body.innerHTML =
      '<div class="ProseMirror"><p><a href="https://example.com" class="editor-inline-link">Link</a></p></div>'
    const anchor = document.querySelector("a")!
    expect(resolveProseMirrorLink(anchor)).toBe(anchor)
  })
})

describe("isInlineEditorLink", () => {
  it("ignores mention anchors", () => {
    document.body.innerHTML =
      '<a href="/documents/a" data-mention="true" class="editor-inline-link"></a>'
    const anchor = document.querySelector("a")!
    expect(isInlineEditorLink(anchor)).toBe(false)
  })

  it("matches styled inline links", () => {
    document.body.innerHTML =
      '<a href="https://example.com" class="editor-inline-link"></a>'
    const anchor = document.querySelector("a")!
    expect(isInlineEditorLink(anchor)).toBe(true)
  })
})

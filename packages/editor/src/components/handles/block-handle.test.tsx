import { render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import type { Block } from "@workspace/editor-core/block-schema/types"
import { EditorProvider } from "../../react/providers/editor-provider"
import { BLOCK_HANDLE_NESTED } from "./block-handle"
import { EditorSurface } from "../editor/editor-surface"

const paragraphDoc: Block[] = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "drag me", styles: {} }],
    children: [],
  },
]

beforeAll(() => {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () =>
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as DOMRectList
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect
  }

  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

function renderSurface(editable = true) {
  return render(
    <EditorProvider initialContent={paragraphDoc} editable={editable}>
      <EditorSurface />
    </EditorProvider>
  )
}

describe("BlockHandle", () => {
  it("renders the drag handle when the editor is editable", () => {
    renderSurface(true)
    expect(screen.getByTestId("block-handle")).toBeInTheDocument()
  })

  it("does not render the drag handle when the editor is read-only", () => {
    renderSurface(false)
    expect(screen.queryByTestId("block-handle")).not.toBeInTheDocument()
  })

  it("enables nested dragging for the block tree model", () => {
    expect(BLOCK_HANDLE_NESTED).toBe(true)
  })
})

describe("editor styles", () => {
  it("ships editor.css with ProseMirror, task, placeholder, drag, and caret classes", () => {
    const stylesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../styles/editor.css"
    )
    const css = readFileSync(stylesPath, "utf8")

    expect(css).toContain(".ProseMirror")
    expect(css).toContain(".ProseMirror > *")
    expect(css).toContain("margin-inline-start: 0")
    expect(css).toContain('ul[data-type="taskList"]')
    expect(css).toContain("is-editor-empty")
    expect(css).toContain("data-placeholder")
    expect(css).toContain(".ProseMirror-selectednode")
    expect(css).toContain(".editor-block-handle")
    expect(css).toContain(".ProseMirror-dropcursor")
    expect(css).toContain(".ProseMirror code")
    expect(css).toContain(".ProseMirror h1")
    expect(css).toContain(".ProseMirror h2")
    expect(css).toContain(".ProseMirror h3")
    expect(css).toContain('.ProseMirror ul:not([data-type="taskList"])')
    expect(css).toContain(".ProseMirror ol")
    expect(css).toContain('li[data-checked="true"] > div')
    expect(css).toContain('input[type="checkbox"] + span')
    expect(css).toContain('input[type="checkbox"]:checked + span')
    expect(css).toContain('input[type="checkbox"] + span::after')
    expect(css).toContain("align-items: center")
    expect(css).toContain("display: flex")
    expect(css).toContain("block-size: 1.5rem")
    expect(css).toContain("outline-offset: 2px")
    expect(css).toContain("@media (prefers-reduced-motion: reduce)")
    const normalizedCss = css.toUpperCase()
    expect(normalizedCss).toContain("#24866B")
    expect(normalizedCss).toContain("BACKGROUND: #24866B !IMPORTANT")
    expect(css).toContain("mix-blend-mode: normal")
    expect(css).toContain("border: none")
    expect(css).toContain("box-shadow: none")
    expect(css).toContain(".collaboration-carets__caret")
    expect(css).toContain(".collaboration-carets__selection")
    expect(css).toContain(".collaboration-carets__label")
  })
})

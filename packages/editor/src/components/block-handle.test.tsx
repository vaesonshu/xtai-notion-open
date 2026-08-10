import { render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import type { EditorDocument } from "../core/types"
import { EditorProvider } from "../react/editor-provider"
import { BLOCK_HANDLE_NESTED } from "./block-handle"
import { EditorSurface } from "./editor-surface"

const paragraphDoc: EditorDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "drag me" }],
    },
  ],
}

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
    </EditorProvider>,
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

  it("keeps nested dragging disabled so only top-level blocks move", () => {
    expect(BLOCK_HANDLE_NESTED).toBe(false)
  })
})

describe("editor styles", () => {
  it("ships editor.css with ProseMirror, task, placeholder, drag, and caret classes", () => {
    const stylesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../styles/editor.css",
    )
    const css = readFileSync(stylesPath, "utf8")

    expect(css).toContain(".ProseMirror")
    expect(css).toContain('ul[data-type="taskList"]')
    expect(css).toContain("is-editor-empty")
    expect(css).toContain("data-placeholder")
    expect(css).toContain(".ProseMirror-selectednode")
    expect(css).toContain(".editor-block-handle")
    expect(css).toContain(".collaboration-carets__caret")
    expect(css).toContain(".collaboration-carets__selection")
    expect(css).toContain(".collaboration-carets__label")
  })
})

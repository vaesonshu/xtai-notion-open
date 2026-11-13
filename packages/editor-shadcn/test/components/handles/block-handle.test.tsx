import { render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import type { Block } from "@xtai-notion/editor-core/model/types"
import { EditorProvider } from "@xtai-notion/editor-react/providers/editor-provider"
import { EditorSurface } from "@shadcn-src/components/editor/editor-surface"

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
  it("does not render the side menu until a block is hovered", () => {
    renderSurface(true)
    expect(screen.queryByTestId("block-handle")).not.toBeInTheDocument()
    expect(screen.queryByTestId("block-add")).not.toBeInTheDocument()
  })

  it("does not render the side menu when the editor is read-only", () => {
    renderSurface(false)
    expect(screen.queryByTestId("block-handle")).not.toBeInTheDocument()
    expect(screen.queryByTestId("block-add")).not.toBeInTheDocument()
  })
})

describe("editor styles", () => {
  it("ships editor.css with ProseMirror, task, placeholder, drag, and caret classes", () => {
    const stylesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../src/style.css"
    )
    const css = readFileSync(stylesPath, "utf8")

    expect(css).toContain(".ProseMirror")
    expect(css).toContain("padding-block: 0.375em")
    expect(css).toContain('[data-node-type="blockContainer"]')
    expect(css).toContain("is-editor-empty")
    expect(css).toContain("data-placeholder")
    expect(css).toContain(".ProseMirror-selectednode")
    expect(css).toContain("--editor-block-gutter")
    expect(css).toContain(".editor-block-side-menu")
    expect(css).toContain(".editor-block-side-menu__grip")
    expect(css).toContain(".editor-block-side-menu__add")
    expect(css).toContain(".editor-block-handle")
    expect(css).toContain(".editor-slash-menu")
    expect(css).toContain(".editor-bubble-toolbar")
    expect(css).toMatch(/\.editor-block-side-menu\s*\{[^}]*z-index:\s*1;/s)
    expect(css).toMatch(/\.editor-bubble-toolbar\s*\{[^}]*z-index:\s*50;/s)
    expect(css).toContain(".ProseMirror-dropcursor")
    expect(css).toContain(".ProseMirror code")
    expect(css).toContain(".ProseMirror h1")
    expect(css).toContain(".ProseMirror h2")
    expect(css).toContain(".ProseMirror h3")
    expect(css).toContain('li[data-type="bulletListItem"]')
    expect(css).toContain('li[data-type="numberedListItem"]')
    expect(css).toContain('li[data-type="checkListItem"]')
    expect(css).toContain('li[data-type="checkListItem"][data-checked="true"]')
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

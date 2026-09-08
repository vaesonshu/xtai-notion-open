import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { use, useEffect } from "react"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import { EditorProvider } from "@xtai-notion/editor-react/providers/editor-provider"
import { EditorSurface } from "@shadcn-src/components/editor/editor-surface"

const linkDoc: Block[] = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    type: "paragraph",
    props: {},
    content: [
      {
        type: "link",
        href: "https://example.com/docs",
        content: [{ type: "text", text: "Example link", styles: {} }],
      },
    ],
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

let latestEditor: Editor | null = null

function EditorProbe() {
  const context = use(EditorContext)
  useEffect(() => {
    const blockEditor = context?.blockEditor
    if (!blockEditor) {
      return
    }
    latestEditor = blockEditor.tiptap
    return blockEditor.onChange(() => {
      latestEditor = blockEditor.tiptap
    })
  }, [context?.blockEditor])
  return null
}

async function waitForEditor() {
  await waitFor(() => {
    expect(latestEditor).not.toBeNull()
  })
  return latestEditor!
}

function renderSurface(content: Block[] = linkDoc, editable = true) {
  return render(
    <EditorProvider initialContent={content} editable={editable}>
      <EditorSurface />
      <EditorProbe />
    </EditorProvider>
  )
}

afterEach(() => {
  latestEditor?.destroy()
  latestEditor = null
  vi.restoreAllMocks()
})

describe("EditorSurface link clicks", () => {
  it("shows edit/open actions when clicking a link in edit mode", async () => {
    renderSurface(linkDoc, true)
    await waitForEditor()

    const link = await screen.findByRole("link", { name: "Example link" })
    vi.spyOn(link, "getBoundingClientRect").mockReturnValue({
      x: 12,
      y: 24,
      width: 80,
      height: 18,
      top: 24,
      right: 92,
      bottom: 42,
      left: 12,
      toJSON: () => ({}),
    } as DOMRect)

    await act(async () => {
      fireEvent.click(link)
    })

    expect(await screen.findByTestId("link-click-menu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "编辑链接" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "打开链接" })).toBeInTheDocument()
  })

  it("does not open the slash menu when entering link edit mode", async () => {
    renderSurface(linkDoc, true)
    await waitForEditor()

    const link = await screen.findByRole("link", { name: "Example link" })
    vi.spyOn(link, "getBoundingClientRect").mockReturnValue({
      x: 12,
      y: 24,
      width: 80,
      height: 18,
      top: 24,
      right: 92,
      bottom: 42,
      left: 12,
      toJSON: () => ({}),
    } as DOMRect)

    await act(async () => {
      fireEvent.click(link)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "编辑链接" }))
    })

    expect(await screen.findByLabelText("链接地址")).toBeInTheDocument()
    expect(screen.queryByTestId("slash-menu")).not.toBeInTheDocument()
  })

  it("applies an edited href to the clicked link", async () => {
    renderSurface(linkDoc, true)
    const editor = await waitForEditor()

    const link = await screen.findByRole("link", { name: "Example link" })
    vi.spyOn(link, "getBoundingClientRect").mockReturnValue({
      x: 12,
      y: 24,
      width: 80,
      height: 18,
      top: 24,
      right: 92,
      bottom: 42,
      left: 12,
      toJSON: () => ({}),
    } as DOMRect)

    await act(async () => {
      fireEvent.click(link)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "编辑链接" }))
    })

    const input = await screen.findByLabelText("链接地址")
    await act(async () => {
      fireEvent.change(input, {
        target: { value: "https://example.com/updated" },
      })
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "应用链接" }))
    })

    await waitFor(() => {
      expect(
        editor.isActive("link", { href: "https://example.com/updated" })
      ).toBe(true)
    })
  })

  it("opens links directly in read-only mode", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    renderSurface(linkDoc, false)
    await waitForEditor()

    const link = await screen.findByRole("link", { name: "Example link" })
    await act(async () => {
      fireEvent.click(link)
    })

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/docs",
      "_blank",
      "noopener,noreferrer"
    )
    expect(screen.queryByTestId("link-click-menu")).not.toBeInTheDocument()
  })
})

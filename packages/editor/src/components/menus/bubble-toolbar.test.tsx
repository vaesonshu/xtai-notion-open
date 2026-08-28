import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { use, useEffect } from "react"
import { EditorContext } from "../../react/context/editor-context"
import type { Block } from "../../core/block-schema/types"
import { EditorProvider } from "../../react/providers/editor-provider"
import { EditorSurface } from "../editor/editor-surface"
import { shouldShowBubbleToolbar } from "./bubble-toolbar"

const paragraphDoc: Block[] = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "format this text", styles: {} }],
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

function renderEditableSurface(
  content: Block[] = paragraphDoc,
  editable = true
) {
  return render(
    <EditorProvider initialContent={content} editable={editable}>
      <EditorSurface />
      <EditorProbe />
    </EditorProvider>
  )
}

async function selectFormattableRange(editor: Editor) {
  await act(async () => {
    const textStart = editor.state.doc.textBetween(0, editor.state.doc.content.size).length
      ? 3
      : 1
    editor
      .chain()
      .focus()
      .setTextSelection({ from: textStart, to: textStart + 6 })
      .run()
  })
}

afterEach(() => {
  latestEditor = null
})

describe("shouldShowBubbleToolbar", () => {
  it("returns false for an empty cursor selection", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    act(() => {
      editor!.chain().focus().setTextSelection(1).run()
    })

    const { state } = editor!
    const { from, to } = state.selection
    expect(
      shouldShowBubbleToolbar({
        editor: editor!,
        state,
        from,
        to,
      })
    ).toBe(false)
  })

  it("returns true for a non-empty formattable text selection", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    act(() => {
      editor!.chain().focus().setTextSelection({ from: 1, to: 7 }).run()
    })

    const { state } = editor!
    const { from, to } = state.selection
    expect(
      shouldShowBubbleToolbar({
        editor: editor!,
        state,
        from,
        to,
      })
    ).toBe(true)
  })
})

describe("BubbleToolbar", () => {
  it("shows the toolbar when a formattable range is selected", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await selectFormattableRange(editor!)

    const toolbar = await screen.findByTestId("bubble-toolbar")
    expect(toolbar).toBeInTheDocument()
    expect(toolbar).toHaveClass("bg-white")
    expect(toolbar).toHaveClass("text-[#242321]")
    const bold = screen.getByRole("button", { name: "粗体" })
    expect(bold).toHaveClass("hover:!bg-[#F3F2EF]")
    expect(screen.getByRole("button", { name: "粗体" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "链接" })).toBeInTheDocument()
  })

  it("uses the selected color for marks already active in the selection", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!
        .chain()
        .focus()
        .setTextSelection({ from: 1, to: 7 })
        .toggleBold()
        .run()
    })

    const bold = await screen.findByRole("button", { name: "粗体" })
    expect(bold).toHaveAttribute("data-pressed")
    expect(bold).toHaveClass("!bg-[#E6F3EC]")
    expect(bold).toHaveClass("!text-[#24866B]")
  })

  it("does not show the toolbar for an empty cursor", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus().setTextSelection(1).run()
    })

    await waitFor(() => {
      expect(screen.queryByTestId("bubble-toolbar")).not.toBeInTheDocument()
    })
  })

  it("toggles bold on the current selection", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await selectFormattableRange(editor!)
    const bold = await screen.findByRole("button", { name: "粗体" })

    await act(async () => {
      fireEvent.click(bold)
    })

    await waitFor(() => {
      expect(editor!.isActive("bold")).toBe(true)
    })
    expect(bold).toHaveAttribute("data-pressed")
    expect(editor!.state.selection.empty).toBe(false)
  })

  it("toggles inline code on the current selection", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await selectFormattableRange(editor!)
    const code = await screen.findByRole("button", { name: "行内代码" })

    await act(async () => {
      fireEvent.click(code)
    })

    await waitFor(() => {
      expect(editor!.isActive("code")).toBe(true)
    })
    expect(code).toHaveAttribute("data-pressed")
  })

  it("sets and removes a link on the current selection", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await selectFormattableRange(editor!)
    const linkButton = await screen.findByRole("button", { name: "链接" })

    await act(async () => {
      fireEvent.click(linkButton)
    })

    const input = await screen.findByLabelText("链接地址")
    await act(async () => {
      fireEvent.change(input, { target: { value: "https://example.com/docs" } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "应用链接" }))
    })

    await waitFor(() => {
      expect(
        editor!.isActive("link", { href: "https://example.com/docs" })
      ).toBe(true)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "链接" }))
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "移除链接" }))
    })

    await waitFor(() => {
      expect(editor!.isActive("link")).toBe(false)
    })
  })

  it("does not mount the toolbar when the editor is read-only", async () => {
    renderEditableSurface(paragraphDoc, false)
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().setTextSelection({ from: 1, to: 7 }).run()
    })

    expect(screen.queryByTestId("bubble-toolbar")).not.toBeInTheDocument()
  })
})

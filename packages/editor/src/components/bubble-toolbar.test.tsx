import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { useEffect } from "react"
import type { EditorDocument } from "../core/types"
import { EditorProvider } from "../react/editor-provider"
import { useEditorInstance } from "../react/use-editor-instance"
import { EditorSurface } from "./editor-surface"
import { shouldShowBubbleToolbar } from "./bubble-toolbar"

const paragraphDoc: EditorDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "format this text" }],
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

let latestEditor: Editor | null = null

function EditorProbe() {
  const editor = useEditorInstance()
  useEffect(() => {
    latestEditor = editor
  }, [editor])
  return null
}

function renderEditableSurface(
  content: EditorDocument = paragraphDoc,
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
    editor.chain().focus().setTextSelection({ from: 1, to: 7 }).run()
  })
}

afterEach(() => {
  latestEditor = null
})

describe("shouldShowBubbleToolbar", () => {
  it("returns false for an empty cursor selection", () => {
    renderEditableSurface()
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

  it("returns true for a non-empty formattable text selection", () => {
    renderEditableSurface()
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
    expect(editor!.state.selection.from).toBe(1)
    expect(editor!.state.selection.to).toBe(7)
  })

  it("toggles inline code on the current selection", async () => {
    renderEditableSurface()
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
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().setTextSelection({ from: 1, to: 7 }).run()
    })

    expect(screen.queryByTestId("bubble-toolbar")).not.toBeInTheDocument()
  })
})

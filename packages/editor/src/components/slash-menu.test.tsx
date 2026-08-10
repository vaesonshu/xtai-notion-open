import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { useEffect } from "react"
import type { EditorDocument } from "../core/types"
import { EditorProvider } from "../react/editor-provider"
import { useEditorInstance } from "../react/use-editor-instance"
import { EditorSurface } from "./editor-surface"

const emptyParagraph: EditorDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
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

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
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

function renderEditableSurface(content: EditorDocument = emptyParagraph) {
  return render(
    <EditorProvider initialContent={content}>
      <EditorSurface />
      <EditorProbe />
    </EditorProvider>,
  )
}

function dispatchEditorKey(editor: Editor, key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    code: key === " " ? "Space" : key,
    bubbles: true,
    cancelable: true,
  })
  editor.view.someProp("handleKeyDown", handleKeyDown => handleKeyDown(editor.view, event))
}

afterEach(() => {
  latestEditor = null
})

describe("SlashMenu", () => {
  it("shows the code block command after typing /代码", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u4ee3\u7801").run()
    })

    const option = await screen.findByRole("option", { name: /\u4ee3\u7801\u5757/ })
    expect(option).toBeInTheDocument()
    expect(option).toHaveClass("data-[selected]:!bg-[#E6F3EC]")
  })

  it("converts the current block to a codeBlock when the command is executed", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u4ee3\u7801").run()
    })

    const option = await screen.findByRole("option", { name: /\u4ee3\u7801\u5757/ })
    await act(async () => {
      fireEvent.click(option)
    })

    await waitFor(() => {
      expect(editor!.getJSON().content?.[0]).toMatchObject({ type: "codeBlock" })
    })
  })

  it("closes on Escape without changing the document", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u4ee3\u7801").run()
    })

    expect(await screen.findByRole("option", { name: /\u4ee3\u7801\u5757/ })).toBeInTheDocument()
    const before = editor!.getJSON()

    await act(async () => {
      dispatchEditorKey(editor!, "Escape")
    })

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: /\u4ee3\u7801\u5757/ })).not.toBeInTheDocument()
    })
    expect(editor!.getJSON()).toEqual(before)
  })

  it("supports ArrowDown selection and Enter execution", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/").run()
    })

    expect(await screen.findByRole("option", { name: /\u4e00\u7ea7\u6807\u9898/ })).toBeInTheDocument()

    await act(async () => {
      dispatchEditorKey(editor!, "ArrowDown")
    })

    await act(async () => {
      dispatchEditorKey(editor!, "Enter")
    })

    await waitFor(() => {
      expect(editor!.getJSON().content?.[0]).toMatchObject({
        type: "heading",
        attrs: { level: 2 },
      })
    })
  })

  it("keeps editor focus after opening so query filtering can continue", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/").run()
    })

    expect(await screen.findByTestId("slash-menu")).toBeInTheDocument()
    expect(screen.getByTestId("slash-menu")).toHaveClass("bg-white")
    expect(screen.getByTestId("slash-menu")).toHaveClass("text-[#242321]")
    expect(screen.getByTestId("slash-menu").firstElementChild).toHaveClass(
      "bg-white",
    )

    await waitFor(() => {
      expect(editor!.isFocused).toBe(true)
    })

    await act(async () => {
      editor!.commands.insertContent("\u4ee3\u7801")
    })

    expect(
      await screen.findByRole("option", { name: /\u4ee3\u7801\u5757/ }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("slash-menu")).toBeInTheDocument()
    expect(editor!.isFocused).toBe(true)
  })
})

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useEffect } from "react"
import type { EditorDocument } from "../../core/types"
import { EditorProvider } from "../../react/providers/editor-provider"
import { useEditorInstance } from "../../react/hooks/use-editor-instance"
import { EditorSurface } from "../editor/editor-surface"
import { ImageUpload } from "../nodes/image-upload"

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

function renderEditableSurface(
  content: EditorDocument = emptyParagraph,
  imageUpload?: (file: File) => Promise<{
    publicUrl: string
    contentType: string
  }>
) {
  return render(
    <EditorProvider initialContent={content} imageUpload={imageUpload}>
      <ImageUpload>
        <EditorSurface />
        <EditorProbe />
      </ImageUpload>
    </EditorProvider>
  )
}

function dispatchEditorKey(editor: Editor, key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    code: key === " " ? "Space" : key,
    bubbles: true,
    cancelable: true,
  })
  editor.view.someProp("handleKeyDown", (handleKeyDown) =>
    handleKeyDown(editor.view, event)
  )
}

afterEach(() => {
  cleanup()
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

    const option = await screen.findByRole("option", {
      name: /\u4ee3\u7801\u5757/,
    })
    expect(option).toBeInTheDocument()
    expect(option).toHaveClass("data-[selected]:!bg-[#E6F3EC]")
  })

  it("shows upload only when configured and deletes the slash range", async () => {
    const upload = async () => ({
      publicUrl: "https://cdn.example/image.png",
      contentType: "image/png",
    })
    renderEditableSurface(emptyParagraph, upload)
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/上传").run()
    })

    const option = await screen.findByRole("option", { name: "上传图片" })
    await act(async () => {
      fireEvent.click(option)
    })

    await waitFor(() => {
      expect(editor!.getJSON().content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "imageUpload" }),
        ])
      )
    })
  })

  it("does not show upload without an upload handler", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/").run()
    })

    await screen.findByRole("option", { name: /一级标题/ })
    expect(
      screen.queryByRole("option", { name: "上传图片" })
    ).not.toBeInTheDocument()
  })

  it("converts the current block to a codeBlock when the command is executed", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u4ee3\u7801").run()
    })

    const option = await screen.findByRole("option", {
      name: /\u4ee3\u7801\u5757/,
    })
    await act(async () => {
      fireEvent.click(option)
    })

    await waitFor(() => {
      expect(editor!.getJSON().content?.[0]).toMatchObject({
        type: "codeBlock",
      })
    })
  })

  it.each([
    ["一级标题", 1],
    ["二级标题", 2],
    ["三级标题", 3],
  ])("converts the current block to %s from the menu", async (label, level) => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/").run()
    })

    const option = await screen.findByRole("option", { name: label })
    await act(async () => {
      fireEvent.click(option)
    })

    await waitFor(() => {
      expect(editor!.getJSON().content?.[0]).toMatchObject({
        type: "heading",
        attrs: { level },
      })
    })
  })

  it.each([
    ["无序列表", "bulletList"],
    ["有序列表", "orderedList"],
  ])(
    "converts the current block to %s from the menu",
    async (label, nodeType) => {
      renderEditableSurface()
      const editor = latestEditor
      expect(editor).not.toBeNull()

      await act(async () => {
        editor!.chain().focus("start").insertContent("/").run()
      })

      const option = await screen.findByRole("option", { name: label })
      await act(async () => {
        fireEvent.click(option)
      })

      await waitFor(() => {
        expect(editor!.getJSON().content?.[0]).toMatchObject({ type: nodeType })
      })
    }
  )

  it("closes on Escape without changing the document", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u4ee3\u7801").run()
    })

    expect(
      await screen.findByRole("option", { name: /\u4ee3\u7801\u5757/ })
    ).toBeInTheDocument()
    const before = editor!.getJSON()

    await act(async () => {
      dispatchEditorKey(editor!, "Escape")
    })

    await waitFor(() => {
      expect(
        screen.queryByRole("option", { name: /\u4ee3\u7801\u5757/ })
      ).not.toBeInTheDocument()
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

    expect(
      await screen.findByRole("option", { name: /\u4e00\u7ea7\u6807\u9898/ })
    ).toBeInTheDocument()

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
      "bg-white"
    )

    await waitFor(() => {
      expect(editor!.isFocused).toBe(true)
    })

    await act(async () => {
      editor!.commands.insertContent("\u4ee3\u7801")
    })

    expect(
      await screen.findByRole("option", { name: /\u4ee3\u7801\u5757/ })
    ).toBeInTheDocument()
    expect(screen.getByTestId("slash-menu")).toBeInTheDocument()
    expect(editor!.isFocused).toBe(true)
  })

  it("inserts a table via the grid picker from the table command", async () => {
    renderEditableSurface()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u8868\u683c").run()
    })

    const option = await screen.findByRole("option", { name: /表格/ })
    await act(async () => {
      fireEvent.click(option)
    })

    // 表格项展开内嵌网格，点击 2×2 的单元格提交。
    const cell = await screen.findByTestId("table-grid-cell-1-1")
    await act(async () => {
      fireEvent.click(cell)
    })

    await waitFor(() => {
      const table = editor!.getJSON().content?.find(
        (node) => node.type === "table"
      ) as { type: string; content?: unknown[] } | undefined
      expect(table?.type).toBe("table")
      expect(table?.content).toHaveLength(2)
    })
  })
})

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
import { EditorContext } from "../../react/context/editor-context"
import { use } from "react"
import type { Block } from "../../core/block-schema/types"
import { EditorProvider } from "../../react/providers/editor-provider"
import { EditorSurface } from "../editor/editor-surface"
import { ImageUpload } from "../nodes/image-upload"

const EMPTY_BLOCK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TEXT_BLOCK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const emptyParagraph: Block[] = [
  {
    id: EMPTY_BLOCK_ID,
    type: "paragraph",
    props: {},
    content: [],
    children: [],
  },
]

const textParagraph: Block[] = [
  {
    id: TEXT_BLOCK_ID,
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "Hello", styles: {} }],
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

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

let latestEditor: Editor | null = null
let latestBlocks: Block[] = []

function EditorProbe() {
  const context = use(EditorContext)
  useEffect(() => {
    const blockEditor = context?.blockEditor
    if (!blockEditor) {
      return
    }
    latestEditor = blockEditor.tiptap
    latestBlocks = blockEditor.document
    return blockEditor.onChange((blocks) => {
      latestBlocks = blocks
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
  content: Block[] = emptyParagraph,
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
  latestBlocks = []
})

describe("SlashMenu", () => {
  it("shows the code block command after typing /代码", async () => {
    renderEditableSurface()
    await waitForEditor()
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
    await waitForEditor()
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
      expect(
        latestBlocks.some(
          (block) =>
            block.type === "image" ||
            editor!.getJSON().content?.some((node) =>
              JSON.stringify(node).includes("imageUpload")
            )
        )
      ).toBe(true)
    })
  })

  it("does not show upload without an upload handler", async () => {
    renderEditableSurface()
    await waitForEditor()
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
    await waitForEditor()
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
      expect(latestBlocks[0]?.type).toBe("codeBlock")
    })
  })

  it("converts an empty block to heading in place", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/").run()
    })

    const option = await screen.findByRole("option", { name: "一级标题" })
    await act(async () => {
      fireEvent.click(option)
    })

    await waitFor(() => {
      expect(latestBlocks[0]?.type).toBe("heading")
      expect(latestBlocks[0]?.id).toBe(EMPTY_BLOCK_ID)
    })
  })

  it("inserts heading after a block that already has text", async () => {
    renderEditableSurface(textParagraph)
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/").run()
    })

    const option = await screen.findByRole("option", { name: "一级标题" })
    await act(async () => {
      fireEvent.click(option)
    })

    await waitFor(() => {
      expect(latestBlocks[0]?.type).toBe("paragraph")
      expect(latestBlocks[1]?.type).toBe("heading")
    })
  })

  it.each([
    ["一级标题", 1],
    ["二级标题", 2],
    ["三级标题", 3],
  ])("converts the current block to %s from the menu", async (label, level) => {
    renderEditableSurface()
    await waitForEditor()
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
      expect(latestBlocks[0]).toMatchObject({
        type: "heading",
        props: { level },
      })
    })
  })

  it.each([
    ["无序列表", "bulletListItem"],
    ["有序列表", "numberedListItem"],
  ])(
    "converts the current block to %s from the menu",
    async (label, blockType) => {
      renderEditableSurface()
      await waitForEditor()
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
        expect(latestBlocks[0]?.type).toBe(blockType)
      })
    }
  )

  it("closes on Escape without changing the document", async () => {
    renderEditableSurface()
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u4ee3\u7801").run()
    })

    expect(
      await screen.findByRole("option", { name: /\u4ee3\u7801\u5757/ })
    ).toBeInTheDocument()
    const before = [...latestBlocks]

    await act(async () => {
      dispatchEditorKey(editor!, "Escape")
    })

    await waitFor(() => {
      expect(
        screen.queryByRole("option", { name: /\u4ee3\u7801\u5757/ })
      ).not.toBeInTheDocument()
    })
    expect(latestBlocks).toEqual(before)
  })

  it("supports ArrowDown selection and Enter execution", async () => {
    renderEditableSurface()
    await waitForEditor()
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
      expect(latestBlocks[0]).toMatchObject({
        type: "heading",
        props: { level: 2 },
      })
    })
  })

  it("keeps editor focus after opening so query filtering can continue", async () => {
    renderEditableSurface()
    await waitForEditor()
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
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("/\u8868\u683c").run()
    })

    const option = await screen.findByRole("option", { name: /表格/ })
    await act(async () => {
      fireEvent.mouseEnter(option)
    })

    const cell = await screen.findByTestId("table-grid-cell-1-1")
    await act(async () => {
      fireEvent.click(cell)
    })

    await waitFor(() => {
      const table = latestBlocks.find((block) => block.type === "table")
      expect(table?.type).toBe("table")
      expect((table?.content as { rows: unknown[] })?.rows).toHaveLength(2)
    })
  })
})

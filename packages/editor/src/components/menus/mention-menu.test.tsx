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
import { use, useEffect } from "react"
import { EditorContext } from "../../react/context/editor-context"
import type { Block } from "@workspace/editor-core/block-schema/types"
import type { MentionableItem } from "@workspace/editor-core/mention"
import { DocumentEditor } from "../editor/document-editor"

const emptyParagraph: Block[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "paragraph",
    props: {},
    content: [],
    children: [],
  },
]

const mentionItems: MentionableItem[] = [
  { id: "doc-1", title: "产品需求文档", href: "/documents/doc-1" },
  { id: "doc-2", title: "技术方案", href: "/documents/doc-2" },
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

function renderWithMention(
  provider: (query: string) => MentionableItem[] | Promise<MentionableItem[]>
) {
  return render(
    <DocumentEditor
      content={emptyParagraph}
      mentionProvider={provider}
      renderSurface={(surface) => (
        <>
          {surface}
          <EditorProbe />
        </>
      )}
    />
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

/** 块 schema 下第一段 blockContent 节点（通常为 paragraph） */
function firstBlockContent(editor: Editor): Record<string, unknown> | undefined {
  const doc = editor.getJSON() as {
    content?: Array<{ content?: Array<{ content?: unknown[] }> }>
  }
  return doc.content?.[0]?.content?.[0]?.content?.[0] as
    | Record<string, unknown>
    | undefined
}

afterEach(() => {
  cleanup()
  latestEditor = null
})

describe("MentionMenu", () => {
  it("opens on @ and lists candidate documents", async () => {
    renderWithMention(() => mentionItems)
    await waitForEditor()
    const editor = latestEditor
    expect(editor).not.toBeNull()

    await act(async () => {
      editor!.chain().focus("start").insertContent("@").run()
    })

    const option = await screen.findByRole("option", {
      name: "产品需求文档",
    })
    expect(option).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "技术方案" })).toBeInTheDocument()
  })

  it("filters candidates as the query grows", async () => {
    renderWithMention(() => mentionItems)
    await waitForEditor()
    const editor = latestEditor

    await act(async () => {
      editor!.chain().focus("start").insertContent("@技术").run()
    })

    expect(
      await screen.findByRole("option", { name: "技术方案" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "产品需求文档" })
    ).not.toBeInTheDocument()
  })

  it("inserts a mention node when an option is selected", async () => {
    renderWithMention(() => mentionItems)
    await waitForEditor()
    const editor = latestEditor

    await act(async () => {
      editor!.chain().focus("start").insertContent("@").run()
    })

    const option = await screen.findByRole("option", {
      name: "产品需求文档",
    })
    await act(async () => {
      fireEvent.click(option)
    })

    await waitFor(() => {
      const paragraph = firstBlockContent(editor!)
      expect(paragraph).toMatchObject({
        type: "paragraph",
        content: [
          {
            type: "mention",
            attrs: {
              id: "doc-1",
              label: "产品需求文档",
              href: "/documents/doc-1",
            },
          },
        ],
      })
    })
  })

  it("shows empty state when no candidates match", async () => {
    renderWithMention(() => [])
    await waitForEditor()
    const editor = latestEditor

    await act(async () => {
      editor!.chain().focus("start").insertContent("@").run()
    })

    expect(await screen.findByText("没有匹配的文档")).toBeInTheDocument()
  })

  it("closes on Escape without changing the document", async () => {
    renderWithMention(() => mentionItems)
    await waitForEditor()
    const editor = latestEditor

    await act(async () => {
      editor!.chain().focus("start").insertContent("@").run()
    })

    expect(
      await screen.findByRole("option", { name: "产品需求文档" })
    ).toBeInTheDocument()
    const before = editor!.getJSON()

    await act(async () => {
      dispatchEditorKey(editor!, "Escape")
    })

    await waitFor(() => {
      expect(
        screen.queryByRole("option", { name: "产品需求文档" })
      ).not.toBeInTheDocument()
    })
    expect(editor!.getJSON()).toEqual(before)
  })

  it("supports ArrowDown selection and Enter execution", async () => {
    renderWithMention(() => mentionItems)
    await waitForEditor()
    const editor = latestEditor

    await act(async () => {
      editor!.chain().focus("start").insertContent("@").run()
    })

    expect(
      await screen.findByRole("option", { name: "产品需求文档" })
    ).toBeInTheDocument()

    await act(async () => {
      dispatchEditorKey(editor!, "ArrowDown")
    })
    await act(async () => {
      dispatchEditorKey(editor!, "Enter")
    })

    await waitFor(() => {
      const paragraph = firstBlockContent(editor!)
      expect(paragraph).toMatchObject({
        content: [
          {
            type: "mention",
            attrs: {
              id: "doc-2",
              label: "技术方案",
              href: "/documents/doc-2",
            },
          },
        ],
      })
    })
  })

  it("supports async providers", async () => {
    const provider = vi.fn(() => Promise.resolve(mentionItems))
    renderWithMention(provider)
    await waitForEditor()
    const editor = latestEditor

    await act(async () => {
      editor!.chain().focus("start").insertContent("@").run()
    })

    expect(
      await screen.findByRole("option", { name: "产品需求文档" })
    ).toBeInTheDocument()
  })
})

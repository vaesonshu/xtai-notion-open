import { afterEach, describe, expect, it } from "vitest"
import { NodeSelection } from "@tiptap/pm/state"
import { BlockEditor } from "@core/editor/block-editor"
import { handleBackspace, handleEnter } from "@core/extensions/block-keymap"

const editors: BlockEditor[] = []

function createWithText(text: string, id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
  const editor = new BlockEditor({
    initialContent: [
      {
        id,
        type: "paragraph",
        props: {},
        content: [{ type: "text", text, styles: {} }],
        children: [],
      },
    ],
  })
  editors.push(editor)
  return editor
}

/** 模拟按键：先走 editorProps，再走插件 handleKeyDown（斜杠菜单优先于块级 Enter） */
function dispatchKey(editor: BlockEditor, key: string, code: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    bubbles: true,
    cancelable: true,
  })
  const view = editor.tiptap.view
  const handleKeyDown = view.props.handleKeyDown

  if (handleKeyDown?.(view, event)) {
    return true
  }

  let handled = false
  view.someProp("handleKeyDown", (handler) => {
    if (handler(view, event)) {
      handled = true
    }
  })
  return handled
}

/** 模拟按下 Enter，走与浏览器一致的 keydown 路径 */
function pressEnter(editor: BlockEditor) {
  return dispatchKey(editor, "Enter", "Enter")
}

function pressBackspace(editor: BlockEditor) {
  return dispatchKey(editor, "Backspace", "Backspace")
}

/** 定位到文档末尾（段落文字结尾） */
function selectEnd(editor: BlockEditor) {
  editor.tiptap.commands.setTextSelection(
    editor.tiptap.state.doc.content.size - 2
  )
}

/** 定位到首个文本节点内的字符偏移 */
function selectTextOffset(editor: BlockEditor, offset: number) {
  editor.tiptap.state.doc.descendants((node, pos) => {
    if (!node.isText) {
      return
    }
    editor.tiptap.commands.setTextSelection(pos + offset)
    return false
  })
}

/** 定位到第二个顶层 blockContainer 内的 textblock 开头 */
function selectSecondBlockStart(editor: BlockEditor) {
  const doc = editor.tiptap.state.doc
  const blockGroup = doc.firstChild

  if (!blockGroup || blockGroup.type.name !== "blockGroup") {
    return
  }

  const firstContainer = blockGroup.child(0)
  const secondContainerPos = 1 + firstContainer.nodeSize
  editor.tiptap.commands.setTextSelection(secondContainerPos + 2)
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("BlockKeymap", () => {
  it("inserts a new paragraph when Enter is pressed at the end", () => {
    const editor = createWithText("hello")
    selectEnd(editor)
    expect(pressEnter(editor)).toBe(true)
    expect(editor.document).toHaveLength(2)
    expect(editor.document[0]?.content).toEqual([
      { type: "text", text: "hello", styles: {} },
    ])
    expect(editor.document[1]?.type).toBe("paragraph")
  })

  it("splits a paragraph when Enter is pressed in the middle", () => {
    const editor = createWithText("hello")
    selectTextOffset(editor, 2)
    expect(pressEnter(editor)).toBe(true)
    expect(editor.document).toHaveLength(2)
    expect(editor.document[0]?.content).toEqual([
      { type: "text", text: "he", styles: {} },
    ])
    expect(editor.document[1]?.content).toEqual([
      { type: "text", text: "llo", styles: {} },
    ])
  })

  it("moves the cursor into a new checkListItem when Enter is pressed at the end", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "checkListItem",
          props: { checked: false },
          content: [{ type: "text", text: "buy milk", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)
    selectEnd(editor)
    expect(pressEnter(editor)).toBe(true)
    expect(editor.document).toHaveLength(2)
    expect(editor.document[1]?.type).toBe("checkListItem")

    let secondContainerPos = 0
    let seen = 0
    editor.tiptap.state.doc.descendants((node, pos) => {
      if (node.type.name !== "blockContainer") {
        return
      }
      seen += 1
      if (seen === 2) {
        secondContainerPos = pos
      }
    })

    expect(editor.tiptap.state.selection.from).toBe(secondContainerPos + 2)
    expect(editor.tiptap.state.selection.empty).toBe(true)
  })

  it("converts an empty checkListItem to paragraph when Enter is pressed again", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "checkListItem",
          props: { checked: false },
          content: [{ type: "text", text: "buy milk", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)
    selectEnd(editor)
    expect(pressEnter(editor)).toBe(true)
    expect(editor.document[1]?.type).toBe("checkListItem")

    expect(pressEnter(editor)).toBe(true)
    expect(editor.document).toHaveLength(2)
    expect(editor.document[0]?.type).toBe("checkListItem")
    expect(editor.document[1]?.type).toBe("paragraph")
  })

  it("converts a lone empty checkListItem to paragraph on Enter", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "checkListItem",
          props: { checked: false },
          content: [],
          children: [],
        },
      ],
    })
    editors.push(editor)
    editor.tiptap.commands.setTextSelection(2)
    expect(pressEnter(editor)).toBe(true)
    expect(editor.document).toHaveLength(1)
    expect(editor.document[0]?.type).toBe("paragraph")
  })

  it.each([
    ["bulletListItem", { type: "bulletListItem" as const, props: {} }],
    ["numberedListItem", { type: "numberedListItem" as const, props: {} }],
    [
      "heading",
      { type: "heading" as const, props: { level: 1 } },
    ],
    ["quote", { type: "quote" as const, props: {} }],
  ])(
    "continues %s on Enter at end, then exits to paragraph when empty",
    (_label, block) => {
      const editor = new BlockEditor({
        initialContent: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            ...block,
            content: [{ type: "text", text: "line one", styles: {} }],
            children: [],
          },
        ],
      })
      editors.push(editor)
      selectEnd(editor)

      expect(pressEnter(editor)).toBe(true)
      expect(editor.document).toHaveLength(2)
      expect(editor.document[1]?.type).toBe(block.type)

      expect(pressEnter(editor)).toBe(true)
      expect(editor.document).toHaveLength(2)
      expect(editor.document[0]?.type).toBe(block.type)
      expect(editor.document[1]?.type).toBe("paragraph")
    }
  )

  it("deletes an empty trailing block on Backspace at start", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "one", styles: {} }],
          children: [],
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          type: "paragraph",
          props: {},
          content: [],
          children: [],
        },
      ],
    })
    editors.push(editor)
    selectSecondBlockStart(editor)
    expect(pressBackspace(editor)).toBe(true)
    expect(editor.document).toHaveLength(1)
  })

  it("converts an empty checkListItem to paragraph on Backspace at start", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "checkListItem",
          props: { checked: false },
          content: [],
          children: [],
        },
      ],
    })
    editors.push(editor)
    editor.tiptap.commands.setTextSelection(2)
    expect(pressBackspace(editor)).toBe(true)
    expect(editor.document).toHaveLength(1)
    expect(editor.document[0]?.type).toBe("paragraph")
  })

  it("converts empty bulletListItem via handleBackspace directly", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "above", styles: {} }],
          children: [],
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          type: "bulletListItem",
          props: {},
          content: [],
          children: [],
        },
      ],
    })
    editors.push(editor)
    selectSecondBlockStart(editor)
    expect(
      handleBackspace(editor.tiptap.state, editor.tiptap.view.dispatch)
    ).toBe(true)
    expect(editor.document).toHaveLength(2)
    expect(editor.document[1]?.type).toBe("paragraph")
  })

  it.each([
    ["bulletListItem", { type: "bulletListItem" as const, props: {} }],
    ["numberedListItem", { type: "numberedListItem" as const, props: {} }],
    [
      "heading",
      { type: "heading" as const, props: { level: 1 } },
    ],
    ["quote", { type: "quote" as const, props: {} }],
  ])(
    "converts empty %s to paragraph on Backspace at start instead of deleting",
    (_label, block) => {
      const editor = new BlockEditor({
        initialContent: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "above", styles: {} }],
            children: [],
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            ...block,
            content: [],
            children: [],
          },
        ],
      })
      editors.push(editor)
      selectSecondBlockStart(editor)
      expect(pressBackspace(editor)).toBe(true)
      expect(editor.document).toHaveLength(2)
      expect(editor.document[0]?.type).toBe("paragraph")
      expect(editor.document[1]?.type).toBe("paragraph")
    }
  )

  it.each([
    ["divider", { type: "divider" as const, props: {} }],
    [
      "image",
      {
        type: "image" as const,
        props: { src: null, uploadStatus: "idle" },
      },
    ],
    [
      "canvas",
      {
        type: "canvas" as const,
        props: { canvasId: "canvas-1", snapshot: "" },
      },
    ],
  ])(
    "inserts a paragraph below atom %s when Enter is pressed with NodeSelection",
    (_label, block) => {
      const editor = new BlockEditor({
        initialContent: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            ...block,
            children: [],
          },
        ],
      })
      editors.push(editor)

      let atomPos = 0
      editor.tiptap.state.doc.descendants((node, pos) => {
        if (node.type.name === block.type) {
          atomPos = pos
          return false
        }
      })
      editor.tiptap.commands.setNodeSelection(atomPos)

      expect(pressEnter(editor)).toBe(true)
      expect(editor.document).toHaveLength(2)
      expect(editor.document[0]?.type).toBe(block.type)
      expect(editor.document[1]?.type).toBe("paragraph")
    }
  )

  it.each([
    [
      "table",
      {
        type: "table" as const,
        props: {},
        content: {
          headerRows: 1,
          rows: [
            {
              cells: [{ content: [] }, { content: [] }, { content: [] }],
            },
          ],
        },
      },
    ],
    [
      "codeBlock",
      {
        type: "codeBlock" as const,
        props: { language: null },
        content: [],
      },
    ],
  ])(
    "inserts a paragraph below %s when Enter is pressed with NodeSelection",
    (_label, block) => {
      const editor = new BlockEditor({
        initialContent: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            ...block,
            children: [],
          },
        ],
      })
      editors.push(editor)

      let containerPos = 0
      editor.tiptap.state.doc.descendants((node, pos) => {
        if (node.type.name === "blockContainer") {
          containerPos = pos
          return false
        }
      })
      editor.tiptap.view.dispatch(
        editor.tiptap.state.tr.setSelection(
          NodeSelection.create(editor.tiptap.state.doc, containerPos)
        )
      )
      expect(editor.tiptap.state.selection).toBeInstanceOf(NodeSelection)

      expect(
        handleEnter(editor.tiptap.state, editor.tiptap.view.dispatch)
      ).toBe(true)
      expect(editor.document).toHaveLength(2)
      expect(editor.document[0]?.type).toBe(block.type)
      expect(editor.document[1]?.type).toBe("paragraph")
    }
  )

  it("does not insert a top-level paragraph when Enter is pressed inside a code block", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "codeBlock",
          props: { language: null },
          content: [{ type: "text", text: "line one", styles: {} }],
          children: [],
        },
      ],
    })
    editors.push(editor)
    selectEnd(editor)

    pressEnter(editor)
    expect(editor.document).toHaveLength(1)
    expect(editor.document[0]?.type).toBe("codeBlock")
  })
})

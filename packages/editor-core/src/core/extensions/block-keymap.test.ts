import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "../block-editor"

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

/** 模拟按下 Enter，走与浏览器一致的 keydown 路径 */
function pressEnter(editor: BlockEditor) {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  })
  let handled = false
  editor.tiptap.view.someProp("handleKeyDown", (handleKeyDown) => {
    if (handleKeyDown(editor.tiptap.view, event)) {
      handled = true
    }
  })
  return handled
}

function pressBackspace(editor: BlockEditor) {
  const event = new KeyboardEvent("keydown", {
    key: "Backspace",
    code: "Backspace",
    bubbles: true,
    cancelable: true,
  })
  let handled = false
  editor.tiptap.view.someProp("handleKeyDown", (handleKeyDown) => {
    if (handleKeyDown(editor.tiptap.view, event)) {
      handled = true
    }
  })
  return handled
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

/** 定位到第二个 blockContainer 内的空段落开头 */
function selectSecondBlockStart(editor: BlockEditor) {
  let targetPos = 0
  let seen = 0
  editor.tiptap.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") {
      return
    }
    seen += 1
    if (seen === 2) {
      targetPos = pos + 2
    }
  })
  editor.tiptap.commands.setTextSelection(targetPos)
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
})

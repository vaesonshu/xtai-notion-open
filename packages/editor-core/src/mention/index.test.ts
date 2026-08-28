import { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { describe, expect, it } from "vitest"
import { MentionNode } from "../extensions"
import {
  filterMentionItems,
  insertMention,
  type MentionableItem,
} from "./index"

const items: MentionableItem[] = [
  { id: "doc-1", title: "产品需求文档", href: "/documents/doc-1" },
  { id: "doc-2", title: "技术方案", href: "/documents/doc-2" },
]

function createEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      MentionNode,
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  })
}

describe("filterMentionItems", () => {
  it("returns all items for an empty query", () => {
    expect(filterMentionItems(items, "")).toEqual(items)
    expect(filterMentionItems(items, "  ")).toEqual(items)
  })

  it("filters by title case-insensitively", () => {
    expect(filterMentionItems(items, "技术")).toEqual([items[1]])
    expect(filterMentionItems(items, "产品")).toEqual([items[0]])
  })

  it("filters by id", () => {
    expect(filterMentionItems(items, "doc-2")).toEqual([items[1]])
  })
})

describe("insertMention", () => {
  it("inserts an atomic mention node with id, label, and href", () => {
    const editor = createEditor()
    editor.chain().focus("start").insertContent("@").run()

    insertMention(editor, { from: 0, to: 1 }, items[0]!)

    const doc = editor.getJSON()
    const paragraph = doc.content?.[0]
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
    editor.destroy()
  })
})

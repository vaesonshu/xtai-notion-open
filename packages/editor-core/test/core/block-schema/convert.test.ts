import { Editor, Node } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"
import { generateBlockId } from "@core/block-schema/ids"
import { createEmptyBlocks, createStarterBlocks } from "@core/block-schema/documents"
import { createBlockSchemaExtensions } from "@core/extensions"
import { blocksToPmDoc, pmDocToBlocks } from "@core/block-schema/convert"

const editors: Editor[] = []

function createEditor(content: ReturnType<typeof createStarterBlocks>) {
  const editor = new Editor({
    extensions: createBlockSchemaExtensions(),
    content: undefined,
  })
  // 用块转换灌入 PM 文档，避免旧 HTML 解析走 StarterKit。
  const doc = blocksToPmDoc(content, editor.schema)
  editor.commands.setContent(doc.toJSON())
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("block pm roundtrip", () => {
  it("round-trips starter blocks including list item as a block", () => {
    const original = createStarterBlocks()
    const editor = createEditor(original)
    const restored = pmDocToBlocks(editor.state.doc)
    expect(restored.map((block) => block.type)).toEqual(
      original.map((block) => block.type)
    )
    expect(restored[2]?.type).toBe("bulletListItem")
  })

  it("round-trips nested children, table, image, canvas, and mention", () => {
    const parentId = "11111111-1111-4111-8111-111111111111"
    const childId = "22222222-2222-4222-8222-222222222222"
    const blocks = [
      {
        id: parentId,
        type: "paragraph" as const,
        props: {},
        content: [
          { type: "text" as const, text: "hi ", styles: { bold: true } },
          {
            type: "mention" as const,
            id: "doc-target",
            label: "Target",
            href: "/documents/doc-target",
          },
        ],
        children: [
          {
            id: childId,
            type: "paragraph" as const,
            props: {},
            content: [{ type: "text" as const, text: "nested", styles: {} }],
            children: [],
          },
        ],
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "table" as const,
        props: {},
        content: {
          headerRows: 1,
          rows: [
            {
              cells: [
                {
                  content: [{ type: "text" as const, text: "A", styles: {} }],
                },
                {
                  content: [{ type: "text" as const, text: "B", styles: {} }],
                },
              ],
            },
          ],
        },
        children: [],
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        type: "image" as const,
        props: { src: "https://example.com/a.png", uploadStatus: "idle" },
        children: [],
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        type: "canvas" as const,
        props: { canvasId: "c1", snapshot: '{"elements":[]}' },
        children: [],
      },
    ]
    const editor = createEditor(blocks)
    const restored = pmDocToBlocks(editor.state.doc)
    expect(restored[0]?.children[0]?.content).toEqual(
      blocks[0]?.children[0]?.content
    )
    expect(restored[0]?.content).toEqual(blocks[0]?.content)
    expect(restored[1]?.type).toBe("table")
    expect(restored[2]?.props).toMatchObject({
      src: "https://example.com/a.png",
    })
    expect(restored[3]?.type).toBe("canvas")
  })

  it("keeps at least one paragraph for empty input", () => {
    const editor = createEditor(createEmptyBlocks())
    expect(pmDocToBlocks(editor.state.doc)).toHaveLength(1)
  })

  it("falls back unknown PM blockContent nodes to paragraph blocks", () => {
    const UnknownLegacyBlock = Node.create({
      name: "unknownLegacyBlock",
      group: "blockContent",
      content: "inline*",
    })
    const extensions = [...createBlockSchemaExtensions(), UnknownLegacyBlock]
    const editor = new Editor({ extensions })
    const schema = editor.schema
    const unknownLegacyBlock = schema.nodes.unknownLegacyBlock
    const blockContainer = schema.nodes.blockContainer
    const blockGroup = schema.nodes.blockGroup
    const docType = schema.nodes.doc
    if (!unknownLegacyBlock || !blockContainer || !blockGroup || !docType) {
      throw new Error("block schema nodes missing for unknown type test")
    }

    const unknownContent = unknownLegacyBlock.create(
      null,
      schema.text("legacy inline")
    )
    const container = blockContainer.create({ id: generateBlockId() }, [
      unknownContent,
    ])
    const group = blockGroup.create(null, [container])
    const doc = docType.create(null, group)

    const blocks = pmDocToBlocks(doc)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe("paragraph")
    expect(blocks[0]?.content).toEqual([
      { type: "text", text: "legacy inline", styles: {} },
    ])

    editor.destroy()
  })
})

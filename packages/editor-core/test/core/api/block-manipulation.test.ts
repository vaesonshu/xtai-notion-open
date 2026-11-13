import { afterEach, describe, expect, it } from "vitest"
import { pmDocToBlocks } from "@core/block-schema/convert"
import { createEmptyBlocks } from "@core/block-schema/documents"
import { generateBlockId } from "@core/block-schema/ids"
import type { Block } from "@core/block-schema/types"
import { BlockEditor } from "@core/block-editor"
import {
  findBlockById,
  findContainerById,
  getActiveBlockContainerId,
  insertBlocks,
  normalizePartialBlock,
  removeBlocks,
} from "@core/api"

const editors: BlockEditor[] = []

/** 测试夹具：只暴露 Tiptap Editor，块操纵走 core/api 纯函数 */
function createTiptapFixture(blocks: Block[]) {
  const wrapper = new BlockEditor({ initialContent: blocks })
  editors.push(wrapper)
  return wrapper.tiptap
}

const TWO_PARAGRAPHS: Block[] = [
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
    content: [{ type: "text", text: "two", styles: {} }],
    children: [],
  },
]

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("core/api 块树工具", () => {
  it("findBlockById 在嵌套 children 中解析 id", () => {
    const nested: Block[] = [
      {
        id: "parent-block-id",
        type: "paragraph",
        props: {},
        content: [],
        children: [
          {
            id: "child-block-id",
            type: "paragraph",
            props: {},
            content: [],
            children: [],
          },
        ],
      },
    ]

    expect(findBlockById(nested, "child-block-id")?.id).toBe("child-block-id")
    expect(findBlockById(nested, "missing-id")).toBeNull()
  })

  it("normalizePartialBlock 会为缺省字段补 id 与空 children", () => {
    const block = normalizePartialBlock({ type: "paragraph" })
    expect(block.id.length).toBeGreaterThan(10)
    expect(block.props).toEqual({})
    expect(block.children).toEqual([])
  })

  it("findContainerById 能在 PM 文档上定位 blockContainer", () => {
    const tiptap = createTiptapFixture(TWO_PARAGRAPHS)
    const ref = findContainerById(
      tiptap.state.doc,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )
    expect(ref?.node.attrs.id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    expect(ref?.depth).toBe(0)
  })
})

describe("core/api 块操纵命令", () => {
  it("insertBlocks 在 refId 不存在时保持文档不变", () => {
    const tiptap = createTiptapFixture(TWO_PARAGRAPHS)
    const before = pmDocToBlocks(tiptap.state.doc)

    insertBlocks(
      tiptap,
      [
        {
          type: "paragraph",
          content: [{ type: "text", text: "ghost", styles: {} }],
        },
      ],
      "00000000-0000-4000-8000-000000000099",
      "after"
    )

    expect(pmDocToBlocks(tiptap.state.doc)).toEqual(before)
  })

  it("insertBlocks after 将新块插在参考块之后", () => {
    const tiptap = createTiptapFixture(TWO_PARAGRAPHS)
    const newId = generateBlockId()

    insertBlocks(
      tiptap,
      [
        {
          id: newId,
          type: "paragraph",
          content: [{ type: "text", text: "three", styles: {} }],
        },
      ],
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "after"
    )

    const ids = pmDocToBlocks(tiptap.state.doc).map((block) => block.id)
    expect(ids[1]).toBe(newId)
  })

  it("removeBlocks 删光后补一块空段落", () => {
    const tiptap = createTiptapFixture(TWO_PARAGRAPHS)

    removeBlocks(tiptap, [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ])

    const document = pmDocToBlocks(tiptap.state.doc)
    expect(document).toHaveLength(1)
    expect(document[0]?.type).toBe("paragraph")
    expect(document[0]?.content).toEqual([])
  })

  it("getActiveBlockContainerId 与折叠光标所在块一致", () => {
    const tiptap = createTiptapFixture(TWO_PARAGRAPHS)
    tiptap.commands.setTextSelection(3)

    expect(getActiveBlockContainerId(tiptap)).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )
  })

  it("removeBlocks 对空 id 列表不破坏仅有的一块占位段落", () => {
    const tiptap = createTiptapFixture(createEmptyBlocks())
    const before = pmDocToBlocks(tiptap.state.doc)

    removeBlocks(tiptap, [])

    expect(pmDocToBlocks(tiptap.state.doc)).toEqual(before)
  })
})

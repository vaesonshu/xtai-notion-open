import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import { applyAiWriteOp } from "@core/ai-write"
import {
  createBlockSchemaYDoc,
  documentFromYjs,
  forkYDoc,
  mergeForkInto,
} from "@core/yjs-document"

const PARA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function para(text: string) {
  return {
    id: PARA_ID,
    type: "paragraph" as const,
    props: {},
    content: [{ type: "text" as const, text, styles: {} }],
    children: [],
  }
}

describe("forkYDoc / mergeForkInto", () => {
  const editors: BlockEditor[] = []
  afterEach(() => {
    for (const editor of editors) editor.destroy()
    editors.length = 0
  })

  it("keeps shared unchanged while ops apply on the fork editor", () => {
    const shared = createBlockSchemaYDoc([para("one")])
    const fork = forkYDoc(shared)
    const forkEditor = new BlockEditor({
      applyInitialContent: false,
      extensions: { document: fork },
    })
    editors.push(forkEditor)

    applyAiWriteOp(forkEditor, {
      type: "insert_blocks",
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })

    expect(documentFromYjs(shared)).toHaveLength(1)
    expect(documentFromYjs(fork)).toHaveLength(2)
  })

  it("merges fork incremental updates into shared", () => {
    const shared = createBlockSchemaYDoc([para("one")])
    const fork = forkYDoc(shared)
    const forkEditor = new BlockEditor({
      applyInitialContent: false,
      extensions: { document: fork },
    })
    editors.push(forkEditor)
    applyAiWriteOp(forkEditor, {
      type: "insert_blocks",
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })

    mergeForkInto(shared, fork)
    expect(
      documentFromYjs(shared).map((block) =>
        Array.isArray(block.content) ? block.content[0] : null
      )
    ).toEqual([
      { type: "text", text: "one", styles: {} },
      { type: "text", text: "two", styles: {} },
    ])
  })

  it("does not change shared when the fork is discarded", () => {
    const shared = createBlockSchemaYDoc([para("one")])
    const fork = forkYDoc(shared)
    const forkEditor = new BlockEditor({
      applyInitialContent: false,
      extensions: { document: fork },
    })
    editors.push(forkEditor)
    applyAiWriteOp(forkEditor, {
      type: "insert_blocks",
      refId: PARA_ID,
      placement: "after",
      blocks: [{ type: "paragraph", text: "two" }],
    })
    fork.destroy()
    expect(documentFromYjs(shared)).toHaveLength(1)
  })
})

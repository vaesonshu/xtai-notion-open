import { afterEach, describe, expect, it } from "vitest"
import type { Doc as YDoc } from "yjs"
import {
  BlockEditor,
  createBlockSchemaYDoc,
  documentFromYjs,
  forkYDoc,
} from "@xtai-notion/editor-core"
import { createAiWritingSession } from "@/lib/ai-writing/session"
import { readAiWriteSse } from "@/lib/ai-writing/client"

const PARA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const editors: BlockEditor[] = []
const ydocs: YDoc[] = []
const sessions: ReturnType<typeof createAiWritingSession>[] = []

function para(text: string) {
  return {
    id: PARA_ID,
    type: "paragraph" as const,
    props: {},
    content: [{ type: "text" as const, text, styles: {} }],
    children: [],
  }
}

/** 共享文档 + fork 文档 + 绑在 fork 上的可见编辑器 */
function createHarness(content = "one") {
  const shared = createBlockSchemaYDoc([para(content)])
  const fork = forkYDoc(shared)
  const forkEditor = new BlockEditor({
    applyInitialContent: false,
    extensions: { document: fork },
  })
  ydocs.push(shared, fork)
  editors.push(forkEditor)
  return { shared, fork, forkEditor }
}

function createSession(
  harness: ReturnType<typeof createHarness>,
  mode: "slash" | "selection" = "slash"
) {
  const session = createAiWritingSession({
    shared: harness.shared,
    fork: harness.fork,
    forkEditor: harness.forkEditor,
    mode,
    cursorBlockId: PARA_ID,
    selectedIds: mode === "selection" ? [PARA_ID] : [],
  })
  sessions.push(session)
  return session
}

const insertOp = {
  type: "insert_blocks" as const,
  refId: PARA_ID,
  placement: "after" as const,
  blocks: [{ type: "paragraph" as const, text: "two" }],
}

afterEach(() => {
  for (const session of sessions) {
    if (session.status !== "closed") {
      session.reject()
    }
  }
  sessions.length = 0
  for (const editor of editors) {
    editor.destroy()
  }
  editors.length = 0
  for (const doc of ydocs) {
    doc.destroy()
  }
  ydocs.length = 0
})

describe("createAiWritingSession", () => {
  it("keeps shared unchanged after applyRemoteOp on the fork editor", () => {
    const harness = createHarness()
    const session = createSession(harness)
    session.applyRemoteOp(insertOp)
    expect(documentFromYjs(harness.shared)).toHaveLength(1)
    expect(harness.forkEditor.document).toHaveLength(2)
    expect(session.ops).toHaveLength(1)
    expect(session.status).toBe("ai-writing")
  })

  it("merges fork into shared on accept", () => {
    const harness = createHarness()
    const session = createSession(harness)
    session.applyRemoteOp(insertOp)
    const result = session.accept()
    expect(result).toEqual({ ok: true })
    expect(documentFromYjs(harness.shared)).toHaveLength(2)
    expect(documentFromYjs(harness.shared)[1]?.content).toEqual([
      { type: "text", text: "two", styles: {} },
    ])
    expect(session.status).toBe("closed")
  })

  it("leaves shared unchanged on reject", () => {
    const harness = createHarness()
    const session = createSession(harness)
    session.applyRemoteOp(insertOp)
    session.reject()
    expect(documentFromYjs(harness.shared)).toHaveLength(1)
    expect(session.status).toBe("closed")
  })

  it("returns empty when accepting with no ops", () => {
    const harness = createHarness()
    const session = createSession(harness)
    expect(session.accept()).toEqual({ ok: false, reason: "empty" })
  })

  it("returns stale after markSharedStale and does not merge", () => {
    const harness = createHarness()
    const session = createSession(harness)
    session.applyRemoteOp(insertOp)
    session.markSharedStale()
    const before = documentFromYjs(harness.shared).length
    const result = session.accept()
    expect(result).toEqual({ ok: false, reason: "stale" })
    expect(documentFromYjs(harness.shared)).toHaveLength(before)
    expect(session.status).not.toBe("closed")
  })

  it("removes empty slash cursor block from fork before merge", () => {
    const harness = createHarness("")
    const session = createSession(harness)
    expect(session.emptyCursorBlockToDelete).toBe(PARA_ID)
    session.applyRemoteOp(insertOp)
    const result = session.accept()
    expect(result).toEqual({ ok: true })
    const sharedBlocks = documentFromYjs(harness.shared)
    expect(sharedBlocks).toHaveLength(1)
    expect(sharedBlocks[0]?.content).toEqual([
      { type: "text", text: "two", styles: {} },
    ])
  })

  it("grows fork text on applyPartial before any tool_call", () => {
    const harness = createHarness()
    const session = createSession(harness)
    session.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "insert_blocks",
      args: {
        refId: PARA_ID,
        placement: "after",
        blocks: [{ type: "paragraph", text: "ai" }],
      },
    })
    expect(harness.forkEditor.document).toHaveLength(2)
    expect(documentFromYjs(harness.shared)).toHaveLength(1)
    expect(session.status).toBe("ai-writing")
  })

  it("synthesizes ops on stop so accept can merge without tool_call", () => {
    const harness = createHarness()
    const session = createSession(harness)
    session.applyPartial({
      type: "tool_partial",
      toolIndex: 0,
      name: "insert_blocks",
      args: {
        refId: PARA_ID,
        placement: "after",
        blocks: [{ type: "paragraph", text: "draft" }],
      },
    })
    session.stop()
    expect(session.status).toBe("user-reviewing")
    expect(session.accept()).toEqual({ ok: true })
    expect(documentFromYjs(harness.shared)).toHaveLength(2)
  })
})

describe("readAiWriteSse", () => {
  it("parses tool_call, done, and error events", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              'event: tool_partial\ndata: {"type":"tool_partial","toolIndex":0,"name":"insert_blocks","args":{"refId":"x","placement":"after","blocks":[{"type":"paragraph","text":"h"}]}}\n\n',
              'event: tool_call\ndata: {"type":"tool_call","op":{"type":"insert_blocks","refId":"x","placement":"after","blocks":[{"type":"paragraph","text":"hi"}]}}\n\n',
              'event: done\ndata: {"type":"done"}\n\n',
              'event: error\ndata: {"type":"error","message":"失败"}\n\n',
            ].join("")
          )
        )
        controller.close()
      },
    })
    const response = new Response(body)
    const events = []
    for await (const event of readAiWriteSse(response)) {
      events.push(event)
    }
    expect(events).toEqual([
      {
        type: "tool_partial",
        toolIndex: 0,
        name: "insert_blocks",
        args: {
          refId: "x",
          placement: "after",
          blocks: [{ type: "paragraph", text: "h" }],
        },
      },
      {
        type: "tool_call",
        op: {
          type: "insert_blocks",
          refId: "x",
          placement: "after",
          blocks: [{ type: "paragraph", text: "hi" }],
        },
      },
      { type: "done" },
      { type: "error", message: "失败" },
    ])
  })
})

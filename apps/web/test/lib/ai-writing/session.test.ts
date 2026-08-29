import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@xtai-notion/editor-core"
import { createAiWritingSession } from "@/lib/ai-writing/session"
import { readAiWriteSse } from "@/lib/ai-writing/client"

const PARA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const editors: BlockEditor[] = []
const sessions: ReturnType<typeof createAiWritingSession>[] = []

function createLive(content = "one") {
  const editor = new BlockEditor({
    initialContent: [
      {
        id: PARA_ID,
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: content, styles: {} }],
        children: [],
      },
    ],
  })
  editors.push(editor)
  return editor
}

function createSession(
  live: BlockEditor,
  mode: "slash" | "selection" = "slash"
) {
  const session = createAiWritingSession({
    live,
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
})

describe("createAiWritingSession", () => {
  it("keeps live unchanged after applyRemoteOp on shadow", () => {
    const live = createLive()
    const session = createSession(live)
    session.applyRemoteOp(insertOp)
    expect(live.document).toHaveLength(1)
    expect(session.shadow.document).toHaveLength(2)
    expect(session.ops).toHaveLength(1)
    expect(session.status).toBe("ai-writing")
  })

  it("replays ops onto live on accept", () => {
    const live = createLive()
    const session = createSession(live)
    session.applyRemoteOp(insertOp)
    const result = session.accept()
    expect(result).toEqual({ ok: true })
    expect(live.document).toHaveLength(2)
    expect(live.document[1]?.content).toEqual([
      { type: "text", text: "two", styles: {} },
    ])
    expect(session.status).toBe("closed")
  })

  it("leaves live unchanged on reject", () => {
    const live = createLive()
    const session = createSession(live)
    session.applyRemoteOp(insertOp)
    session.reject()
    expect(live.document).toHaveLength(1)
    expect(session.status).toBe("closed")
  })

  it("returns stale when ref block was removed before accept", () => {
    const live = createLive()
    const session = createSession(live)
    session.applyRemoteOp(insertOp)
    live.removeBlocks([PARA_ID])
    const before = live.document.length
    const result = session.accept()
    expect(result).toEqual({ ok: false, reason: "stale" })
    expect(live.document).toHaveLength(before)
    expect(session.status).not.toBe("closed")
  })

  it("marks empty slash cursor block for deletion and removes it on accept", () => {
    const live = createLive("")
    const session = createSession(live)
    expect(session.emptyCursorBlockToDelete).toBe(PARA_ID)
    session.applyRemoteOp(insertOp)
    const result = session.accept()
    expect(result).toEqual({ ok: true })
    expect(live.document).toHaveLength(1)
    expect(live.document[0]?.content).toEqual([
      { type: "text", text: "two", styles: {} },
    ])
  })

  it("returns empty when accepting with no ops", () => {
    const live = createLive()
    const session = createSession(live)
    expect(session.accept()).toEqual({ ok: false, reason: "empty" })
  })
})

describe("readAiWriteSse", () => {
  it("parses tool_call, done, and error events", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
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

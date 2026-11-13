import "@testing-library/jest-dom/vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import type { Block } from "@xtai-notion/editor-core/model/types"
import { createEditorSchema } from "@xtai-notion/editor-core/schema"
import { documentFromYjs } from "@xtai-notion/editor-core"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import { CollaborationEditorProvider } from "@xtai-notion/editor-react/providers/collaboration-editor-provider"
import { EditorProvider } from "@xtai-notion/editor-react/providers/editor-provider"
import {
  AiWriteHostContext,
  EditorSurface,
  ImageUpload,
  ShadcnEditorProvider,
} from "@xtai-notion/editor-shadcn"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import * as Y from "yjs"
import { use, useEffect } from "react"
import { toast } from "@/lib/toast"
import { AiWritingHost } from "@/components/inkspace/ai-writing-host"
import { buildClientApiUrl } from "@/lib/api-client"

const PARA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111"

const initialContent: Block[] = [
  {
    id: PARA_ID,
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "hello", styles: {} }],
    children: [],
  },
]

type ProviderListener = (...args: unknown[]) => void

type MockProvider = {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  setAwarenessField: ReturnType<typeof vi.fn>
  awareness: {
    clientID: number
    states: Map<number, Record<string, unknown>>
    getStates: () => Map<number, Record<string, unknown>>
    getLocalState: () => Record<string, unknown> | null
    setStates: (states: Map<number, Record<string, unknown>>) => void
    setLocalStateField: (field: string, value: unknown) => void
    on: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
  }
  emit: (event: string, ...args: unknown[]) => void
}

function createMockProvider(clientID = 1): MockProvider {
  const listeners = new Map<string, Set<ProviderListener>>()
  const awarenessListeners = new Map<string, Set<ProviderListener>>()
  let states = new Map<number, Record<string, unknown>>()

  const on = vi.fn((event: string, listener: ProviderListener) => {
    const set = listeners.get(event) ?? new Set<ProviderListener>()
    set.add(listener)
    listeners.set(event, set)
    return mock
  })

  const off = vi.fn((event: string, listener?: ProviderListener) => {
    const set = listeners.get(event)
    if (!set) {
      return mock
    }
    if (listener) {
      set.delete(listener)
    } else {
      set.clear()
    }
    return mock
  })

  const setLocalStateField = (field: string, value: unknown) => {
    const current = states.get(clientID) ?? {}
    states.set(clientID, { ...current, [field]: value })
  }

  const mock: MockProvider = {
    on,
    off,
    destroy: vi.fn(() => {
      listeners.clear()
      awarenessListeners.clear()
    }),
    setAwarenessField: vi.fn((key: string, value: unknown) => {
      setLocalStateField(key, value)
    }),
    awareness: {
      clientID,
      get states() {
        return states
      },
      getStates: () => states,
      getLocalState: () => states.get(clientID) ?? null,
      setStates: (next) => {
        states = next
      },
      setLocalStateField,
      on: vi.fn(),
      off: vi.fn(),
    },
    emit(event, ...args) {
      const set = listeners.get(event)
      if (!set) {
        return
      }
      for (const listener of [...set]) {
        listener(...args)
      }
    },
  }

  return mock
}

function streamResponse(events: string[]) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event))
      }
      controller.close()
    },
  })
  return { ok: true, body }
}

// 可见编辑器（fork 期间为 fork 编辑器）当前块数；用于断言 fork/shared 改绑
let latestBlockCount = 0
let latestDraftText = ""

function plainTextFromBlock(block: Block | undefined): string {
  if (!block || !Array.isArray(block.content)) {
    return ""
  }
  let text = ""
  for (const item of block.content) {
    if (item.type === "text") {
      text += item.text
    }
  }
  return text
}

function BlockCountProbe() {
  const context = use(EditorContext)
  useEffect(() => {
    const blockEditor = context?.blockEditor
    if (!blockEditor) {
      return
    }
    const sync = () => {
      latestBlockCount = blockEditor.document.length
      // 首块之后的块视为 AI 草稿，用于断言 tool_partial 已写入正文
      latestDraftText = plainTextFromBlock(blockEditor.document[1])
    }
    sync()
    return blockEditor.onChange(sync)
  }, [context?.blockEditor])
  return null
}

function ContextProbe() {
  const handlers = use(AiWriteHostContext)
  return (
    <div data-testid="ai-write-context">
      {handlers ? "enabled" : "disabled"}
    </div>
  )
}

function OpenSlashButton() {
  const handlers = use(AiWriteHostContext)
  return (
    <button type="button" onClick={() => handlers?.openSlash()}>
      打开斜杠写作
    </button>
  )
}

function OpenSelectionButton() {
  const handlers = use(AiWriteHostContext)
  return (
    <button type="button" onClick={() => handlers?.openSelection()}>
      打开选区写作
    </button>
  )
}

// 测试用：在首块内选一段文本，使 getSelectedBlocks 返回非空以触发 selection 入口
function SelectFirstBlockButton() {
  const context = use(EditorContext)
  return (
    <button
      type="button"
      onClick={() => {
        const tiptap = context?.blockEditor?.tiptap
        if (!tiptap) {
          return
        }
        tiptap.commands.focus()
        // 首块文本 "hello" 占据 pos 1..6，选中其中一段触发 blockContainer 命中
        tiptap.commands.setTextSelection({ from: 2, to: 4 })
      }}
    >
      选中首块
    </button>
  )
}

type RenderHostResult = ReturnType<typeof render> & {
  provider: MockProvider
  getSharedDoc: () => Y.Doc | undefined
}

function renderHost(canWrite = true): RenderHostResult {
  const provider = createMockProvider()
  const editorSchema = createEditorSchema()
  // 缓存 createProvider 收到的 shared Y.Doc，用于断言接受前 shared 无 AI 增量
  let sharedDoc: Y.Doc | undefined

  const view = render(
    <ShadcnEditorProvider>
      <CollaborationEditorProvider
        collaboration={{
          documentId: DOCUMENT_ID,
          websocketUrl: "ws://127.0.0.1:3101",
          token: "demo-owner",
          user: { id: "demo-owner", name: "林", color: "#E64B3C" },
        }}
        initialContent={initialContent}
        editorSchema={editorSchema}
        createProvider={(options) => {
          sharedDoc = options.document
          return provider as unknown as HocuspocusProvider
        }}
      >
        <ImageUpload>
          <AiWritingHost
            apiUrl="http://127.0.0.1:3100"
            documentId={DOCUMENT_ID}
            userId="demo-owner"
            canWrite={canWrite}
          >
            <EditorSurface />
            <BlockCountProbe />
            <ContextProbe />
            <OpenSlashButton />
            <OpenSelectionButton />
            <SelectFirstBlockButton />
          </AiWritingHost>
        </ImageUpload>
      </CollaborationEditorProvider>
    </ShadcnEditorProvider>
  )

  return { provider, getSharedDoc: () => sharedDoc, ...view }
}

async function syncEditor(provider: MockProvider) {
  await act(async () => {
    provider.emit("synced", { state: true })
  })
  await waitFor(() => {
    expect(latestBlockCount).toBeGreaterThan(0)
  })
}

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

describe("AiWritingHost", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:3100")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    // setup.ts 中 sonner toast 为共享 vi.fn()，restoreAllMocks 不会清其调用记录，
    // 需显式 clear，避免 not.toHaveBeenCalledWith 跨用例误判
    vi.clearAllMocks()
    latestBlockCount = 0
    latestDraftText = ""
  })

  it("keeps live document unchanged until accept after SSE insert", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as {
        cursorBlockId: string
      }
      return streamResponse([
        `event: tool_call\ndata: ${JSON.stringify({
          type: "tool_call",
          op: {
            type: "insert_blocks",
            refId: body.cursorBlockId,
            placement: "after",
            blocks: [{ type: "paragraph", text: "ai draft" }],
          },
        })}\n\n`,
        'event: done\ndata: {"type":"done"}\n\n',
      ])
    })
    vi.stubGlobal("fetch", fetchMock)

    const { provider, getSharedDoc } = renderHost(true)
    await syncEditor(provider)

    fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))
    expect(screen.getByTestId("ai-write-prompt-bar")).toBeInTheDocument()

    fireEvent.change(screen.getByTestId("ai-write-prompt-input"), {
      target: { value: "续写一段" },
    })
    fireEvent.click(screen.getByRole("button", { name: "生成" }))

    await waitFor(() => {
      expect(screen.getByTestId("ai-write-accept")).toBeInTheDocument()
    })

    // 接受前：可见编辑器已改绑到 fork（2 块），shared Y.Doc 仍是 1 块
    expect(latestBlockCount).toBe(2)
    const sharedDoc = getSharedDoc()!
    expect(documentFromYjs(sharedDoc)).toHaveLength(1)
    // 不再渲染底部独立草稿卡片
    expect(screen.queryByTestId("ai-write-draft")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("ai-write-accept"))

    await waitFor(() => {
      // 接受后：merge 把 fork 增量写进 shared，可见编辑器绑回 shared
      expect(documentFromYjs(sharedDoc)).toHaveLength(2)
    })
    expect(latestBlockCount).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith(
      buildClientApiUrl("/ai/write"),
      expect.objectContaining({
        method: "POST",
      })
    )
  })

  it("shows streamed text in the editor before the tool_call event", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })

    // 先只推 tool_partial，断言可见草稿后再补 tool_call，避免整段 SSE 一次消费
    let releaseToolCall: (() => void) | undefined
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as {
        cursorBlockId: string
      }
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          const enqueue = (chunk: string) => {
            controller.enqueue(encoder.encode(chunk))
          }
          enqueue(
            `event: tool_partial\ndata: ${JSON.stringify({
              type: "tool_partial",
              toolIndex: 0,
              name: "insert_blocks",
              args: {
                refId: body.cursorBlockId,
                placement: "after",
                blocks: [{ type: "paragraph", text: "hel" }],
              },
            })}\n\n`
          )
          releaseToolCall = () => {
            enqueue(
              `event: tool_call\ndata: ${JSON.stringify({
                type: "tool_call",
                toolIndex: 0,
                op: {
                  type: "insert_blocks",
                  refId: body.cursorBlockId,
                  placement: "after",
                  blocks: [{ type: "paragraph", text: "hello" }],
                },
              })}\n\n`
            )
            enqueue('event: done\ndata: {"type":"done"}\n\n')
            controller.close()
          }
        },
      })
      return { ok: true, body: stream }
    })
    vi.stubGlobal("fetch", fetchMock)

    const { provider, getSharedDoc } = renderHost(true)
    await syncEditor(provider)
    fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))
    fireEvent.change(screen.getByTestId("ai-write-prompt-input"), {
      target: { value: "续写一段" },
    })
    fireEvent.click(screen.getByRole("button", { name: "生成" }))

    await waitFor(() => {
      expect(latestBlockCount).toBe(2)
    })
    expect(latestDraftText).toBe("hel")
    expect(documentFromYjs(getSharedDoc()!)).toHaveLength(1)
    expect(screen.queryByTestId("ai-write-accept")).not.toBeInTheDocument()

    await act(async () => {
      releaseToolCall?.()
    })
    await waitFor(() => {
      expect(screen.getByTestId("ai-write-accept")).toBeInTheDocument()
    })
    expect(latestDraftText).toBe("hello")
  })

  it("does not expose AI write context for viewer role", async () => {
    const { provider } = renderHost(false)
    await syncEditor(provider)

    expect(screen.getByTestId("ai-write-context")).toHaveTextContent("disabled")
    expect(
      screen.queryByTestId("ai-write-toolbar-button")
    ).not.toBeInTheDocument()
  })

  it("blocks a second session while one draft is pending review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    )

    const { provider } = renderHost(true)
    await syncEditor(provider)

    fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))
    fireEvent.change(screen.getByTestId("ai-write-prompt-input"), {
      target: { value: "第一段" },
    })
    fireEvent.click(screen.getByRole("button", { name: "生成" }))

    await waitFor(() => {
      expect(screen.getByTestId("ai-write-stop")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))

    expect(toast.error).toHaveBeenCalledWith("请先接受或拒绝当前 AI 草稿")
  })

  it("toasts when the editor lacks rebindVisibleEditor / sharedYDoc", async () => {
    // 非协作 EditorProvider：rebindVisibleEditor 为 undefined、sharedYDoc 为 null
    render(
      <ShadcnEditorProvider>
        <EditorProvider>
          <AiWritingHost
            apiUrl="http://127.0.0.1:3100"
            documentId={DOCUMENT_ID}
            userId="demo-owner"
            canWrite
          >
            <ContextProbe />
            <OpenSlashButton />
          </AiWritingHost>
        </EditorProvider>
      </ShadcnEditorProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId("ai-write-context")).toHaveTextContent(
        "enabled"
      )
    })

    fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))

    expect(toast.error).toHaveBeenCalledWith("当前编辑器不支持 AI 写作")
  })

  it("shows selection presets during user-input before session is created", async () => {
    // 回归：提交前 sessionRef 为 null，presets 必须回退到入口上下文 mode，
    // 否则 selection 模式会错误展示 SLASH 预设
    const { provider } = renderHost(true)
    await syncEditor(provider)

    fireEvent.click(screen.getByRole("button", { name: "选中首块" }))
    fireEvent.click(screen.getByRole("button", { name: "打开选区写作" }))

    expect(screen.getByTestId("ai-write-prompt-bar")).toBeInTheDocument()
    // SELECTION 预设含「润色」；SLASH 预设含「续写」
    expect(screen.getByRole("button", { name: "润色" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "续写" })
    ).not.toBeInTheDocument()
  })

  it("clears session after stop with no ops so user is not locked out", async () => {
    // 回归：thinking 阶段点停止且无任何 tool_call 时，session.stop() 进入 closed，
    // 必须清理 activeRef，否则用户无法再开新会话
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    )

    const { provider } = renderHost(true)
    await syncEditor(provider)

    fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))
    fireEvent.change(screen.getByTestId("ai-write-prompt-input"), {
      target: { value: "续写一段" },
    })
    fireEvent.click(screen.getByRole("button", { name: "生成" }))

    await waitFor(() => {
      expect(screen.getByTestId("ai-write-stop")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId("ai-write-stop"))

    // 停止后提示条关闭，activeRef 已清理
    await waitFor(() => {
      expect(
        screen.queryByTestId("ai-write-prompt-bar")
      ).not.toBeInTheDocument()
    })

    // 再次打开斜杠不应触发「请先接受或拒绝当前 AI 草稿」
    fireEvent.click(screen.getByRole("button", { name: "打开斜杠写作" }))
    expect(screen.getByTestId("ai-write-prompt-bar")).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalledWith("请先接受或拒绝当前 AI 草稿")
  })
})

import "@testing-library/jest-dom/vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import type { Block } from "@xtai-notion/editor-core/block-schema/types"
import { createEditorSchema } from "@xtai-notion/editor-core/schema"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import { CollaborationEditorProvider } from "@xtai-notion/editor-react/providers/collaboration-editor-provider"
import {
  AiWriteHostContext,
  EditorSurface,
  ImageUpload,
  ShadcnEditorProvider,
} from "@xtai-notion/editor-shadcn"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { use, useEffect } from "react"
import { toast } from "sonner"
import { AiWritingHost } from "@/components/inkspace/ai-writing-host"

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

let latestBlockCount = 0

function BlockCountProbe() {
  const context = use(EditorContext)
  useEffect(() => {
    const blockEditor = context?.blockEditor
    if (!blockEditor) {
      return
    }
    const sync = () => {
      latestBlockCount = blockEditor.document.length
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

function renderHost(canWrite = true) {
  const provider = createMockProvider()
  const editorSchema = createEditorSchema()

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
        createProvider={() => provider as unknown as HocuspocusProvider}
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
          </AiWritingHost>
        </ImageUpload>
      </CollaborationEditorProvider>
    </ShadcnEditorProvider>
  )

  return { provider, ...view }
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
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    latestBlockCount = 0
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

    const { provider } = renderHost(true)
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
    expect(latestBlockCount).toBe(1)

    fireEvent.click(screen.getByTestId("ai-write-accept"))

    await waitFor(() => {
      expect(latestBlockCount).toBe(2)
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3100/ai/write",
      expect.objectContaining({
        method: "POST",
      })
    )
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
})

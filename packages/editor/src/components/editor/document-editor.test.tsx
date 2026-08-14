import { act, render, screen, waitFor } from "@testing-library/react"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import { describe, expect, it, vi } from "vitest"
import type { CollaborationConfig } from "../../collaboration/types"
import type { CollaborationUser, EditorDocument } from "../../core/types"
import { DocumentEditor, type DocumentEditorProps } from "./document-editor"

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
    if (set.size === 0) {
      listeners.delete(event)
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
      setStates: next => {
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

const baseUser: CollaborationUser = {
  id: "user-1",
  name: "Ada",
  color: "#2563eb",
}

const baseConfig: CollaborationConfig = {
  documentId: "doc-room-1",
  websocketUrl: "ws://localhost:1234",
  token: "dev-token",
  user: baseUser,
}

const sampleContent: EditorDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "本地正文内容" }],
    },
  ],
}

describe("DocumentEditor", () => {
  it("renders local content mode", () => {
    render(<DocumentEditor content={sampleContent} />)

    expect(screen.getByText("本地正文内容")).toBeInTheDocument()
  })

  it("renders read-only when editable is false", () => {
    const { container } = render(
      <DocumentEditor content={sampleContent} editable={false} />,
    )

    const proseMirror = container.querySelector(".ProseMirror")
    expect(proseMirror).not.toBeNull()
    expect(proseMirror).toHaveAttribute("contenteditable", "false")
  })

  it("throws when content and collaboration are both provided", () => {
    const invalidProps = {
      content: sampleContent,
      collaboration: baseConfig,
      createProvider: () => createMockProvider() as unknown as HocuspocusProvider,
    } as unknown as DocumentEditorProps

    expect(() => render(<DocumentEditor {...invalidProps} />)).toThrow(
      /mutually exclusive|互斥/,
    )
  })

  it("does not render a duplicate in-editor status before sync", () => {
    const provider = createMockProvider()

    render(
      <DocumentEditor
        collaboration={baseConfig}
        createProvider={() => provider as unknown as HocuspocusProvider}
      />,
    )

    expect(screen.queryByRole("status", { name: /连接中/ })).not.toBeInTheDocument()
    expect(screen.getByRole("status", { name: "正在加载编辑器" })).toBeInTheDocument()
  })

  it("waits for sync before rendering the editor toolbar", async () => {
    const provider = createMockProvider()

    render(
      <DocumentEditor
        collaboration={baseConfig}
        createProvider={() => provider as unknown as HocuspocusProvider}
        renderToolbar={() => <div>Editor toolbar</div>}
      />,
    )

    expect(screen.queryByText("Editor toolbar")).not.toBeInTheDocument()

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    expect(await screen.findByText("Editor toolbar")).toBeInTheDocument()
  })

  it("shows synced status after first sync and never shows saved on error", async () => {
    const provider = createMockProvider()

    render(
      <DocumentEditor
        collaboration={baseConfig}
        createProvider={() => provider as unknown as HocuspocusProvider}
      />,
    )

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: /已同步/ })).not.toBeInTheDocument()
    })
    expect(screen.queryByText("已保存")).not.toBeInTheDocument()

    await act(async () => {
      provider.emit("close", { event: { code: 1011 } })
    })

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: /错误/ })).not.toBeInTheDocument()
    })
    expect(screen.queryByText("已保存")).not.toBeInTheDocument()
  })
})

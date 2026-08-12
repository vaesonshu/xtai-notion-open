import "@testing-library/jest-dom/vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DocumentWorkspace,
  type DocumentWorkspaceProps,
} from "./document-workspace"

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
      setStates: (next) => {
        states = next
      },
      setLocalStateField,
      on: vi.fn((event: string, listener: ProviderListener) => {
        const set = awarenessListeners.get(event) ?? new Set<ProviderListener>()
        set.add(listener)
        awarenessListeners.set(event, set)
      }),
      off: vi.fn((event: string, listener?: ProviderListener) => {
        const set = awarenessListeners.get(event)
        if (!set) {
          return
        }
        if (listener) {
          set.delete(listener)
        } else {
          set.clear()
        }
      }),
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

const baseProps: DocumentWorkspaceProps = {
  documentId: "11111111-1111-4111-8111-111111111111",
  user: { id: "demo-owner", name: "林", color: "#E64B3C" },
  apiUrl: "http://127.0.0.1:3100",
  collaborationUrl: "ws://127.0.0.1:3101",
}

function mockDocumentRole(role: "owner" | "editor" | "viewer") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: baseProps.documentId,
        role,
        title: "Demo",
      }),
    })
  )
}

describe("DocumentWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("shows a configuration error when client endpoints are missing", () => {
    render(<DocumentWorkspace {...baseProps} apiUrl="" collaborationUrl="" />)

    expect(screen.getByRole("alert")).toHaveTextContent(/缺少客户端端点|配置/)
    expect(screen.queryByText("新一代知识工作台")).not.toBeInTheDocument()
  })

  it("renders the current document title and parent breadcrumb", async () => {
    mockDocumentRole("owner")
    const provider = createMockProvider()

    render(
      <DocumentWorkspace
        {...baseProps}
        title="子文档"
        parentTitle="项目规划"
        createProvider={() => provider as unknown as HocuspocusProvider}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("子文档")).toBeInTheDocument()
      expect(screen.getByText("项目规划")).toBeInTheDocument()
    })
  })

  it("shows a clear API connection error when metadata fetch is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )

    render(<DocumentWorkspace {...baseProps} />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "无法连接到文档服务，请确认 API 已启动。"
    )
  })

  it("shows a document content skeleton while metadata is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    )

    render(<DocumentWorkspace {...baseProps} />)

    expect(
      screen.getByRole("status", { name: "正在加载文档" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("status").querySelectorAll(".animate-pulse")
    ).toHaveLength(8)
    expect(screen.queryByText("正在打开文档…")).not.toBeInTheDocument()
  })

  it("renders an editable editor after collaboration sync for owner", async () => {
    mockDocumentRole("owner")
    const provider = createMockProvider()

    const { container } = render(
      <DocumentWorkspace
        {...baseProps}
        createProvider={() => provider as unknown as HocuspocusProvider}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /连接中/ })).toBeInTheDocument()
    })

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /已同步/ })).toBeInTheDocument()
    })

    const proseMirror = container.querySelector(".ProseMirror")
    expect(proseMirror).not.toBeNull()
    expect(proseMirror).toHaveAttribute("contenteditable", "true")
  })

  it("renders a read-only editor for viewer members", async () => {
    mockDocumentRole("viewer")
    const provider = createMockProvider()

    const { container } = render(
      <DocumentWorkspace
        {...baseProps}
        user={{ id: "demo-viewer", name: "观", color: "#24866B" }}
        createProvider={() => provider as unknown as HocuspocusProvider}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /连接中/ })).toBeInTheDocument()
    })

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    await waitFor(() => {
      const proseMirror = container.querySelector(".ProseMirror")
      expect(proseMirror).not.toBeNull()
      expect(proseMirror).toHaveAttribute("contenteditable", "false")
    })
  })

  it("surfaces offline collaboration status", async () => {
    mockDocumentRole("editor")
    const provider = createMockProvider()

    render(
      <DocumentWorkspace
        {...baseProps}
        createProvider={() => provider as unknown as HocuspocusProvider}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /连接中/ })).toBeInTheDocument()
    })

    await act(async () => {
      provider.emit("synced", { state: true })
    })
    await waitFor(() => {
      expect(screen.getByRole("status", { name: /已同步/ })).toBeInTheDocument()
    })

    await act(async () => {
      provider.emit("status", { status: "disconnected" })
    })

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /离线/ })).toBeInTheDocument()
    })
    expect(screen.queryByText("已保存")).not.toBeInTheDocument()
  })

  it("surfaces unauthorized collaboration status", async () => {
    mockDocumentRole("owner")
    const provider = createMockProvider()

    render(
      <DocumentWorkspace
        {...baseProps}
        createProvider={() => provider as unknown as HocuspocusProvider}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /连接中/ })).toBeInTheDocument()
    })

    await act(async () => {
      provider.emit("authenticationFailed")
    })

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /无权限/ })).toBeInTheDocument()
    })
    expect(screen.queryByText("已保存")).not.toBeInTheDocument()
  })

  it("surfaces error collaboration status without saved badge", async () => {
    mockDocumentRole("owner")
    const provider = createMockProvider()

    render(
      <DocumentWorkspace
        {...baseProps}
        createProvider={() => provider as unknown as HocuspocusProvider}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /连接中/ })).toBeInTheDocument()
    })

    await act(async () => {
      provider.emit("synced", { state: true })
    })
    await waitFor(() => {
      expect(screen.getByRole("status", { name: /已同步/ })).toBeInTheDocument()
    })

    await act(async () => {
      provider.emit("close", {
        event: { code: 1011, reason: "persist failed" },
      })
    })

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /同步错误|错误/ })
      ).toBeInTheDocument()
    })
    expect(screen.queryByText("已保存")).not.toBeInTheDocument()
  })
})

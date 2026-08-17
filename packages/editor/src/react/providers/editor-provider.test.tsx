import { act, render, screen, waitFor } from "@testing-library/react"
import { StrictMode, use } from "react"
import { Editor } from "@tiptap/core"
import { describe, expect, it, vi } from "vitest"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import { createEditorExtensions } from "../../core/extensions"
import { createStarterDocument } from "../../core/document"
import type { CollaborationConfig } from "../../collaboration/types"
import type { CollaborationUser } from "../../core/types"
import { CollaborationEditorProvider } from "./collaboration-editor-provider"
import { EditorProvider } from "./editor-provider"
import { EditorContext } from "../context/editor-context"
import { useCollaborationStatus } from "../hooks/use-collaboration-status"
import { useCollaborators } from "../hooks/use-collaborators"
import { useEditorChange } from "../hooks/use-editor-change"
import { useEditorInstance } from "../hooks/use-editor-instance"

function EditorName() {
  const context = use(EditorContext)
  if (!context?.editor) {
    return <span>loading</span>
  }
  return (
    <span>{context.editor.options.editable ? "editable" : "readonly"}</span>
  )
}

function InsertContentButton() {
  const context = use(EditorContext)
  if (!context?.editor) {
    return null
  }
  const editor = context.editor
  return (
    <button onClick={() => editor.commands.insertContent("新内容")}>
      insert
    </button>
  )
}

function CollaborationStatusLabel() {
  const status = useCollaborationStatus()
  return <span data-testid="collab-status">{status}</span>
}

function CollaboratorsLabel() {
  const collaborators = useCollaborators()
  return (
    <span data-testid="collaborators">
      {collaborators.map((user) => user.id).join(",")}
    </span>
  )
}

function EditorWhenSynced() {
  const status = useCollaborationStatus()
  if (status !== "synced") {
    return <span data-testid="editor-slot">waiting</span>
  }
  return <EditorDocumentText />
}

function EditorDocumentText() {
  const editor = useEditorInstance()
  useEditorChange()
  return <span data-testid="editor-slot">{editor.getText()}</span>
}

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

  const awarenessOn = vi.fn((event: string, listener: ProviderListener) => {
    const set = awarenessListeners.get(event) ?? new Set<ProviderListener>()
    set.add(listener)
    awarenessListeners.set(event, set)
  })

  const awarenessOff = vi.fn((event: string, listener?: ProviderListener) => {
    const set = awarenessListeners.get(event)
    if (!set) {
      return
    }
    if (listener) {
      set.delete(listener)
    } else {
      set.clear()
    }
  })

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
      on: awarenessOn,
      off: awarenessOff,
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

function seedRemoteDocument(
  document: Y.Doc,
  provider: HocuspocusProvider,
  text: string
) {
  const seed = new Editor({
    extensions: createEditorExtensions({
      document,
      provider,
      user: baseUser,
    }),
  })
  seed.commands.setContent({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  })
  seed.destroy()
}

describe("EditorProvider", () => {
  it("provides an editable editor instance to descendants", async () => {
    render(
      <EditorProvider>
        <EditorName />
      </EditorProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("editable")).toBeInTheDocument()
    })
  })

  it("emits the latest JSON document after an edit", async () => {
    const onChange = vi.fn()
    render(
      <EditorProvider onChange={onChange}>
        <InsertContentButton />
      </EditorProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "insert" })).toBeInTheDocument()
    })
    screen.getByRole("button", { name: "insert" }).click()

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "doc" })
    )
  })

  it("keeps the editor available across StrictMode effect remounts", async () => {
    render(
      <StrictMode>
        <EditorProvider>
          <EditorName />
        </EditorProvider>
      </StrictMode>
    )

    await waitFor(() => {
      expect(screen.getByText("editable")).toBeInTheDocument()
    })
  })

  it("throws when collaboration hooks are used outside collaboration provider", () => {
    expect(() => render(<CollaborationStatusLabel />)).toThrow(
      /useCollaborationStatus must be used inside .*CollaborationEditorProvider/
    )
    expect(() => render(<CollaboratorsLabel />)).toThrow(
      /useCollaborators must be used inside .*CollaborationEditorProvider/
    )
  })
})

describe("CollaborationEditorProvider", () => {
  it("keeps the collaboration session alive across StrictMode effect checks", async () => {
    const provider = createMockProvider()

    render(
      <StrictMode>
        <CollaborationEditorProvider
          collaboration={baseConfig}
          createProvider={() => provider as unknown as HocuspocusProvider}
        >
          <CollaborationStatusLabel />
        </CollaborationEditorProvider>
      </StrictMode>
    )

    expect(provider.destroy).not.toHaveBeenCalled()

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    expect(screen.getByTestId("collab-status")).toHaveTextContent("synced")
  })

  it("does not create an editable editor before the first sync", () => {
    const provider = createMockProvider()

    render(
      <CollaborationEditorProvider
        collaboration={baseConfig}
        createProvider={() => provider as unknown as HocuspocusProvider}
      >
        <CollaborationStatusLabel />
        <EditorWhenSynced />
      </CollaborationEditorProvider>
    )

    expect(screen.getByTestId("collab-status")).toHaveTextContent("connecting")
    expect(screen.getByTestId("editor-slot")).toHaveTextContent("waiting")
  })

  it("creates an editor after sync and writes starter content when remote is empty", async () => {
    const provider = createMockProvider()
    const starter = createStarterDocument()
    const starterText = starter.content
      .map((node) => {
        if (!node.content) {
          return ""
        }
        return node.content
          .map((child) => ("text" in child ? child.text : ""))
          .join("")
      })
      .join("")

    render(
      <CollaborationEditorProvider
        collaboration={baseConfig}
        createProvider={() => provider as unknown as HocuspocusProvider}
      >
        <CollaborationStatusLabel />
        <EditorWhenSynced />
      </CollaborationEditorProvider>
    )

    expect(screen.getByTestId("editor-slot")).toHaveTextContent("waiting")

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    await waitFor(() => {
      expect(screen.getByTestId("collab-status")).toHaveTextContent("synced")
      expect(screen.getByTestId("editor-slot").textContent).toContain(
        "让知识真正流动起来"
      )
    })

    expect(screen.getByTestId("editor-slot").textContent).toContain(
      starterText.slice(0, 8)
    )
    expect(provider.setAwarenessField).toHaveBeenCalledWith("user", baseUser)
  })

  it("does not overwrite remote content with initialContent or starter", async () => {
    const provider = createMockProvider()
    const captured: { document: Y.Doc | null } = { document: null }

    render(
      <CollaborationEditorProvider
        collaboration={baseConfig}
        initialContent={createStarterDocument()}
        createProvider={(options) => {
          captured.document = options.document
          return provider as unknown as HocuspocusProvider
        }}
      >
        <EditorWhenSynced />
      </CollaborationEditorProvider>
    )

    expect(captured.document).toBeInstanceOf(Y.Doc)
    seedRemoteDocument(
      captured.document!,
      provider as unknown as HocuspocusProvider,
      "远端已有正文"
    )

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    await waitFor(() => {
      expect(screen.getByTestId("editor-slot")).toHaveTextContent(
        "远端已有正文"
      )
    })

    expect(screen.getByTestId("editor-slot").textContent).not.toContain(
      "让知识真正流动起来"
    )
  })

  it("updates collaboration status as the session changes", async () => {
    const provider = createMockProvider()

    render(
      <CollaborationEditorProvider
        collaboration={baseConfig}
        createProvider={() => provider as unknown as HocuspocusProvider}
      >
        <CollaborationStatusLabel />
      </CollaborationEditorProvider>
    )

    expect(screen.getByTestId("collab-status")).toHaveTextContent("connecting")

    await act(async () => {
      provider.emit("synced", { state: true })
    })
    expect(screen.getByTestId("collab-status")).toHaveTextContent("synced")

    await act(async () => {
      provider.emit("status", { status: "disconnected" })
    })
    expect(screen.getByTestId("collab-status")).toHaveTextContent("offline")
  })

  it("exposes remote collaborators from awareness", async () => {
    const provider = createMockProvider(7)

    render(
      <CollaborationEditorProvider
        collaboration={baseConfig}
        createProvider={() => provider as unknown as HocuspocusProvider}
      >
        <CollaboratorsLabel />
      </CollaborationEditorProvider>
    )

    await act(async () => {
      provider.awareness.setStates(
        new Map([
          [7, { user: baseUser }],
          [8, { user: { id: "user-2", name: "Grace", color: "#16a34a" } }],
        ])
      )
      provider.emit("awarenessUpdate", {})
    })

    expect(screen.getByTestId("collaborators")).toHaveTextContent("user-2")
    expect(screen.getByTestId("collaborators").textContent).not.toContain(
      "user-1"
    )
  })

  it("destroys editor, provider, and Y.Doc exactly once on unmount", async () => {
    const provider = createMockProvider()
    const captured: { document: Y.Doc | null } = { document: null }
    const editorDestroy = vi.spyOn(Editor.prototype, "destroy")

    const { unmount } = render(
      <CollaborationEditorProvider
        collaboration={baseConfig}
        createProvider={(options) => {
          captured.document = options.document
          return provider as unknown as HocuspocusProvider
        }}
      >
        <EditorWhenSynced />
      </CollaborationEditorProvider>
    )

    await act(async () => {
      provider.emit("synced", { state: true })
    })

    await waitFor(() => {
      expect(screen.getByTestId("editor-slot").textContent).not.toBe("waiting")
    })

    const editorDestroyCallsBeforeUnmount = editorDestroy.mock.calls.length

    await act(async () => {
      unmount()
      await Promise.resolve()
    })

    expect(provider.destroy).toHaveBeenCalledTimes(1)
    expect(captured.document?.isDestroyed).toBe(true)
    expect(
      editorDestroy.mock.calls.length - editorDestroyCallsBeforeUnmount
    ).toBe(1)

    editorDestroy.mockRestore()
  })
})

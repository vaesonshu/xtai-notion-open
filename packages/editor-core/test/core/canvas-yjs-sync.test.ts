import type { HocuspocusProvider } from "@hocuspocus/provider"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import { NodeSelection } from "@tiptap/pm/state"
import { BlockEditor } from "@core/block-editor"
import { createEmptyBlocks } from "@core/block-schema/documents"
import { executeSlashCommand } from "@core/slash-commands"
import type { CollaborationUser } from "@core/types"

const editors: BlockEditor[] = []

function createCollaborativeEditor(
  yDoc: Y.Doc,
  applyInitialContent: boolean,
  withCaret: boolean
): BlockEditor {
  const user: CollaborationUser = {
    id: "user-1",
    name: "Tester",
    color: "#2563eb",
  }
  const provider = { awareness: null } as HocuspocusProvider

  const editor = new BlockEditor({
    initialContent: applyInitialContent ? createEmptyBlocks() : undefined,
    applyInitialContent,
    extensions: {
      document: yDoc,
      ...(withCaret ? { provider, user } : {}),
    },
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("canvas yjs sync", () => {
  it("syncs canvas block conversion to a second editor without Yjs errors", () => {
    const errors: unknown[] = []
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args)
    })

    const sourceDoc = new Y.Doc()
    const source = createCollaborativeEditor(sourceDoc, true, false)
    const blockId = source.document[0]?.id
    expect(blockId).toBeTruthy()

    source.tiptap.commands.setTextSelection(2)
    expect(executeSlashCommand(source, "canvas-block")).toBe(true)
    expect(source.document[0]?.type).toBe("canvas")

    const targetDoc = new Y.Doc()
    Y.applyUpdate(targetDoc, Y.encodeStateAsUpdate(sourceDoc))

    const target = createCollaborativeEditor(targetDoc, false, false)
    expect(target.document[0]?.type).toBe("canvas")

    const yjsErrors = errors.filter((args) =>
      String(args[0] ?? "").includes("Yjs update")
    )
    expect(yjsErrors).toEqual([])

    errorSpy.mockRestore()
    sourceDoc.destroy()
    targetDoc.destroy()
  })

  it("does not leave an out-of-range selection after slash canvas insert", () => {
    const editor = new BlockEditor({
      initialContent: createEmptyBlocks(),
    })
    editors.push(editor)

    editor.tiptap.commands.setTextSelection(2)
    executeSlashCommand(editor, "canvas-block")

    const { from, to } = editor.tiptap.state.selection
    const docSize = editor.tiptap.state.doc.content.size
    expect(() => editor.tiptap.state.doc.resolve(from)).not.toThrow()
    expect(() => editor.tiptap.state.doc.resolve(to)).not.toThrow()
    expect(from).toBeLessThanOrEqual(docSize)
    expect(to).toBeLessThanOrEqual(docSize)
    expect(editor.tiptap.state.selection instanceof NodeSelection).toBe(true)
  })

  it("syncs canvas snapshot attribute updates across editors", () => {
    const sourceDoc = new Y.Doc()
    const source = createCollaborativeEditor(sourceDoc, true, false)
    source.tiptap.commands.setTextSelection(2)
    executeSlashCommand(source, "canvas-block")

    const snapshot = JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [],
      files: {},
    })

    let canvasPos: number | null = null
    source.tiptap.state.doc.descendants((node, pos) => {
      if (node.type.name === "canvas" && canvasPos === null) {
        canvasPos = pos
        return false
      }
      return undefined
    })
    expect(canvasPos).not.toBeNull()

    source.tiptap.view.dispatch(
      source.tiptap.state.tr.setNodeMarkup(canvasPos!, undefined, {
        canvasId: source.document[0]?.props.canvasId ?? "test-canvas",
        snapshot,
      })
    )

    const targetDoc = new Y.Doc()
    Y.applyUpdate(targetDoc, Y.encodeStateAsUpdate(sourceDoc))
    const target = createCollaborativeEditor(targetDoc, false, false)

    expect(target.document[0]?.props.snapshot).toBe(snapshot)

    sourceDoc.destroy()
    targetDoc.destroy()
  })
})

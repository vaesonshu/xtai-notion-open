import { describe, expect, it } from "vitest"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import { Editor } from "@tiptap/core"
import * as Y from "yjs"
import { createEditorExtensions } from "./index"
import { createInitialDocument } from "../document/initial-document"
import type { CollaborationUser } from "../types"

describe("editor core", () => {
  it("creates a non-empty initial document with representative block types", () => {
    const document = createInitialDocument()
    const json = JSON.stringify(document)

    expect(document.type).toBe("doc")
    expect(document.content.length).toBeGreaterThan(0)
    expect(json).toContain('"heading"')
    expect(json).toContain('"bulletList"')
    expect(json).toContain('"blockquote"')
    expect(json).toContain('"codeBlock"')
  })

  it("registers the MVP extensions", () => {
    const names = createEditorExtensions().map((extension) => extension.name)

    expect(names).toEqual(
      expect.arrayContaining([
        "starterKit",
        "taskList",
        "taskItem",
        "placeholder",
        "imageUpload",
      ])
    )
  })

  it("configures Link through StarterKit without duplicate extension names", () => {
    const extensions = createEditorExtensions()
    const starterKit = extensions.find(
      (extension) => extension.name === "starterKit"
    )
    const editor = new Editor({ extensions })
    const names = editor.extensionManager.extensions.map(
      (extension) => extension.name
    )

    expect(starterKit?.options.link).toMatchObject({
      openOnClick: false,
      autolink: true,
    })
    expect(new Set(names)).toHaveLength(names.length)

    editor.destroy()
  })

  it("configures the drop cursor extension", () => {
    const dropCursor = createEditorExtensions().find(
      (extension) => extension.name === "dropCursor"
    )

    expect(dropCursor).toBeDefined()
    expect(dropCursor?.options.color).toBe("#24866B")
    expect(dropCursor?.options.width).toBe(2)
    expect(dropCursor?.options.class).toBe("ProseMirror-dropcursor")
  })

  it("registers exactly one drop cursor extension", () => {
    const dropCursors = createEditorExtensions().filter(
      (extension) => extension.name === "dropCursor"
    )

    expect(dropCursors).toHaveLength(1)
  })

  it("keeps undo and redo enabled in ordinary mode", () => {
    const starterKit = createEditorExtensions().find(
      (extension) => extension.name === "starterKit"
    )

    expect(starterKit?.options.undoRedo).toEqual({})
  })

  it("binds a Y.Doc without a provider for read-only collaboration export", () => {
    const document = new Y.Doc()
    const extensions = createEditorExtensions({ document })
    const collaboration = extensions.find(
      (extension) => extension.name === "collaboration"
    )
    const collaborationCaret = extensions.find(
      (extension) => extension.name === "collaborationCaret"
    )
    const starterKit = extensions.find(
      (extension) => extension.name === "starterKit"
    )

    expect(collaboration).toBeDefined()
    expect(collaboration?.options.document).toBe(document)
    expect(collaborationCaret).toBeUndefined()
    expect(starterKit?.options.undoRedo).toBe(false)

    document.destroy()
  })

  it("passes the collaboration document and provider to collaboration extensions", () => {
    const document = new Y.Doc()
    const provider = {} as HocuspocusProvider
    const user: CollaborationUser = {
      id: "user-1",
      name: "Ada",
      color: "#2563eb",
    }
    const extensions = createEditorExtensions({
      placeholder: "协作文档",
      document,
      provider,
      user,
    })

    const collaboration = extensions.find(
      (extension) => extension.name === "collaboration"
    )
    const collaborationCaret = extensions.find(
      (extension) => extension.name === "collaborationCaret"
    )
    const starterKit = extensions.find(
      (extension) => extension.name === "starterKit"
    )

    expect(collaboration).toBeDefined()
    expect(collaboration?.options.document).toBe(document)
    expect(collaboration?.options.provider).toBe(provider)
    expect(collaborationCaret).toBeDefined()
    expect(collaborationCaret?.options.provider).toBe(provider)
    expect(collaborationCaret?.options.user).toEqual(user)
    expect(starterKit?.options.undoRedo).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import type { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import { createEditorExtensions } from "./extensions.js"
import { createInitialDocument } from "./initial-document.js"

type CollaborationUser = {
  id: string
  name: string
  color: string
}

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
    const names = createEditorExtensions().map(extension => extension.name)

    expect(names).toEqual(expect.arrayContaining([
      "starterKit",
      "link",
      "underline",
      "taskList",
      "taskItem",
      "placeholder",
    ]))
  })

  it("keeps undo and redo enabled in ordinary mode", () => {
    const starterKit = createEditorExtensions().find(
      extension => extension.name === "starterKit",
    )

    expect(starterKit?.options.undoRedo).toEqual({})
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
    } as Parameters<typeof createEditorExtensions>[0])

    const collaboration = extensions.find(
      extension => extension.name === "collaboration",
    )
    const collaborationCaret = extensions.find(
      extension => extension.name === "collaborationCaret",
    )
    const starterKit = extensions.find(
      extension => extension.name === "starterKit",
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

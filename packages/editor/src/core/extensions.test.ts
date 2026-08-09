import { describe, expect, it } from "vitest"
import { createEditorExtensions } from "./extensions.js"
import { createInitialDocument } from "./initial-document.js"

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
})

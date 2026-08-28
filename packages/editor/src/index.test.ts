import { describe, expect, it } from "vitest"
import type { CollaborationUser, EditorExtensionOptions } from "./index"
import { createEmptyDocument, createStarterDocument } from "./index"
import { isBlockArray } from "./core/block-schema/documents"

describe("editor package public types", () => {
  it("exposes collaboration types from the package root", () => {
    const user: CollaborationUser = {
      id: "user-1",
      name: "Ada",
      color: "#2563eb",
    }
    const options: EditorExtensionOptions = { user }

    expect(options.user).toEqual(user)
  })
})

describe("editor package document API", () => {
  it("exposes the stable block document contract from the package root", () => {
    const emptyDocument = createEmptyDocument()
    const starterDocument = createStarterDocument()

    expect(isBlockArray(emptyDocument)).toBe(true)
    expect(isBlockArray(starterDocument)).toBe(true)
  })
})

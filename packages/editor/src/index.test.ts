import { describe, expect, it } from "vitest"
import type { CollaborationUser, EditorExtensionOptions } from "./index.js"

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
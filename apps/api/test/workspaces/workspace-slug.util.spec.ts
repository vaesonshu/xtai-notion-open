import { describe, expect, it } from "vitest"
import {
  isUuid,
  isWorkspaceSlug,
  slugifyWorkspaceName,
} from "@api/workspaces/workspace-slug.util"

describe("workspace-slug.util", () => {
  it("slugifyWorkspaceName normalizes CJK and spaces", () => {
    expect(slugifyWorkspaceName("  Product Docs  ")).toBe("product-docs")
    expect(slugifyWorkspaceName("a")).toBe("workspace")
  })

  it("isWorkspaceSlug validates pattern and length", () => {
    expect(isWorkspaceSlug("ab")).toBe(true)
    expect(isWorkspaceSlug("a")).toBe(false)
    expect(isWorkspaceSlug("UPPER")).toBe(false)
    expect(isWorkspaceSlug("ok-2")).toBe(true)
  })

  it("isUuid detects uuid v4", () => {
    expect(isUuid("ws-1")).toBe(false)
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
  })
})

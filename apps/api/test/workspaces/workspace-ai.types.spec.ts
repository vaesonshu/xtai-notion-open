import { describe, expect, it } from "vitest"
import {
  DEFAULT_WORKSPACE_AI_SETTINGS,
  mergeWorkspaceAiSettings,
  parseWorkspaceAiSettings,
} from "@api/workspaces/workspace-ai.types"

describe("workspace AI settings", () => {
  it("parses defaults for invalid json", () => {
    expect(parseWorkspaceAiSettings(null)).toEqual(DEFAULT_WORKSPACE_AI_SETTINGS)
  })

  it("parses local codex provider and prompt", () => {
    expect(
      parseWorkspaceAiSettings({
        aiProvider: "local_codex",
        localCodexPrompt: "  学术语气  ",
      })
    ).toEqual({
      aiProvider: "local_codex",
      localCodexPrompt: "学术语气",
    })
  })

  it("merges patches without dropping unspecified fields", () => {
    expect(
      mergeWorkspaceAiSettings(
        { aiProvider: "local_codex", localCodexPrompt: "A" },
        { aiProvider: "cloud" }
      )
    ).toEqual({ aiProvider: "cloud", localCodexPrompt: "A" })
  })
})

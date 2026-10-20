import { describe, expect, it } from "vitest"
import {
  mergeUserCloudAiSettings,
  parseUserCloudAiSettings,
  toUserCloudAiSettingsView,
} from "@api/auth/user-ai.types"

describe("user-ai.types", () => {
  it("parses stored json and masks api key in view", () => {
    const parsed = parseUserCloudAiSettings({
      openAiApiKey: "sk-secret",
      openAiBaseUrl: "https://api.example.com/v1",
      openAiModel: "demo",
    })
    const view = toUserCloudAiSettingsView(parsed)
    expect(view.hasApiKey).toBe(true)
    expect(view.openAiApiKey).toBe("")
    expect(view.openAiModel).toBe("demo")
  })

  it("merge clears api key when patch is empty string", () => {
    const next = mergeUserCloudAiSettings(
      { openAiApiKey: "sk-old", openAiModel: "m1" },
      { openAiApiKey: "" }
    )
    expect(next.openAiApiKey).toBeUndefined()
    expect(next.openAiModel).toBe("m1")
  })
})

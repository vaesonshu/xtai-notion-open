import { describe, expect, it } from "vitest"
import { defaultBridgeConfig } from "../src/config.js"

describe("bridge config", () => {
  it("defaults to port 3847 with empty workspace map", () => {
    const config = defaultBridgeConfig()
    expect(config.port).toBe(3847)
    expect(config.workspaces).toEqual({})
  })
})

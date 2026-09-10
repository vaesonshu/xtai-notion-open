import { describe, expect, it } from "vitest"
import { resolveBridgeCorsOrigins } from "../src/lib/codex-bridge-host"

describe("resolveBridgeCorsOrigins", () => {
  it("includes local Next dev origins", () => {
    expect(resolveBridgeCorsOrigins("")).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ])
  })

  it("adds the packaged web app origin for CORS", () => {
    expect(
      resolveBridgeCorsOrigins("https://inkspace.example.vercel.app/")
    ).toContain("https://inkspace.example.vercel.app")
  })
})

import { describe, expect, it } from "vitest"
import { readEnvValue } from "../src/lib/env-file"

describe("readEnvValue", () => {
  it("reads the first unquoted assignment and skips comments", () => {
    const text = "# x\nXT_DESKTOP_APP_URL=https://app.vercel.app/\n"
    expect(readEnvValue(text, "XT_DESKTOP_APP_URL")).toBe(
      "https://app.vercel.app/"
    )
  })
})

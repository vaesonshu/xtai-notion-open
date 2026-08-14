import { describe, expect, it } from "vitest"
import { loadEnvironment } from "./environment"

describe("loadEnvironment AI settings", () => {
  it("reads optional OpenAI-compatible settings without making them required", () => {
    const base = {
      PORT: "3100",
      DATABASE_URL: "postgres://db",
      COLLABORATION_PORT: "3101",
      NODE_ENV: "test",
    }

    expect(loadEnvironment({ ...base })).toMatchObject({
      OPENAI_API_KEY: undefined,
      OPENAI_BASE_URL: undefined,
      OPENAI_MODEL: undefined,
    })
    expect(
      loadEnvironment({
        ...base,
        OPENAI_API_KEY: "key",
        OPENAI_BASE_URL: "http://localhost/v1",
        OPENAI_MODEL: "model",
      })
    ).toMatchObject({
      OPENAI_API_KEY: "key",
      OPENAI_BASE_URL: "http://localhost/v1",
      OPENAI_MODEL: "model",
    })
  })
})

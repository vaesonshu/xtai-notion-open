import { ServiceUnavailableException } from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import { UserCloudAiService } from "@api/auth/user-cloud-ai.service"

describe("UserCloudAiService", () => {
  it("requireLlmConfig prefers user settings over environment", async () => {
    const users = {
      getAiSettings: vi.fn().mockResolvedValue({
        openAiApiKey: "sk-user",
        openAiBaseUrl: "https://user.example/v1",
        openAiModel: "user-model",
      }),
    }
    const service = new UserCloudAiService(users as any, {
      OPENAI_API_KEY: "sk-env",
      OPENAI_BASE_URL: "https://env.example/v1",
      OPENAI_MODEL: "env-model",
    } as any)

    await expect(service.requireLlmConfig("user-1")).resolves.toEqual({
      apiKey: "sk-user",
      baseUrl: "https://user.example/v1",
      model: "user-model",
    })
  })

  it("requireLlmConfig rejects when neither user nor env has credentials", async () => {
    const users = { getAiSettings: vi.fn().mockResolvedValue(null) }
    const service = new UserCloudAiService(users as any, {} as any)

    await expect(service.requireLlmConfig("user-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    )
  })
})

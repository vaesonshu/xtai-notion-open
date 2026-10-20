import { apiRequestJson } from "@/lib/api-client"

export type UserCloudAiSettings = {
  openAiApiKey: string
  openAiBaseUrl: string
  openAiModel: string
  hasApiKey: boolean
}

export async function fetchUserCloudAiSettings(
  userId: string
): Promise<UserCloudAiSettings> {
  return apiRequestJson<UserCloudAiSettings>({
    path: "/users/me/cloud-ai-settings",
    userId,
  })
}

export async function updateUserCloudAiSettings(
  userId: string,
  patch: {
    openAiApiKey?: string
    openAiBaseUrl?: string
    openAiModel?: string
  }
): Promise<UserCloudAiSettings> {
  return apiRequestJson<UserCloudAiSettings>({
    path: "/users/me/cloud-ai-settings",
    method: "PATCH",
    userId,
    json: patch,
  })
}

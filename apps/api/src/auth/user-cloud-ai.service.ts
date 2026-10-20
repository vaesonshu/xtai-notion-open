import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common"
import type { LlmConnectionConfig } from "../ai/llm-config.types"
import type { Environment } from "../config/environment"
import { ENVIRONMENT } from "../config/tokens"
import { UserRepository } from "./user.repository"
import {
  DEFAULT_OPENAI_BASE_URL,
  mergeUserCloudAiSettings,
  parseUserCloudAiSettings,
  toUserCloudAiSettingsView,
  type UserCloudAiSettingsView,
} from "./user-ai.types"

@Injectable()
export class UserCloudAiService {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(ENVIRONMENT) private readonly environment: Environment
  ) {}

  async getSettings(userId: string): Promise<UserCloudAiSettingsView> {
    const raw = await this.users.getAiSettings(userId)
    return toUserCloudAiSettingsView(parseUserCloudAiSettings(raw))
  }

  async updateSettings(
    userId: string,
    patch: {
      openAiApiKey?: string
      openAiBaseUrl?: string
      openAiModel?: string
    }
  ): Promise<UserCloudAiSettingsView> {
    const current = await this.users.getAiSettings(userId)
    const next = mergeUserCloudAiSettings(current, patch)
    if (next.openAiBaseUrl && !/^https?:\/\//i.test(next.openAiBaseUrl)) {
      throw new BadRequestException("接口地址需以 http:// 或 https:// 开头")
    }
    await this.users.setAiSettings(userId, next)
    return toUserCloudAiSettingsView(next)
  }

  /** 云端写作/对话使用的 LLM；优先个人中心配置，环境变量仅作开发兜底。 */
  async requireLlmConfig(userId: string): Promise<LlmConnectionConfig> {
    const raw = await this.users.getAiSettings(userId)
    const userSettings = parseUserCloudAiSettings(raw)
    const apiKey =
      userSettings.openAiApiKey?.trim() ||
      this.environment.OPENAI_API_KEY?.trim() ||
      ""
    const baseUrl =
      userSettings.openAiBaseUrl?.trim() ||
      this.environment.OPENAI_BASE_URL?.trim() ||
      DEFAULT_OPENAI_BASE_URL
    const model =
      userSettings.openAiModel?.trim() ||
      this.environment.OPENAI_MODEL?.trim() ||
      ""

    if (!apiKey || !model) {
      throw new ServiceUnavailableException(
        "请在个人中心 → AI 设置中配置云端 API Key 与模型"
      )
    }

    return { apiKey, baseUrl, model }
  }
}

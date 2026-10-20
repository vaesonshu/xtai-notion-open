import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common"
import { AuthenticatedIdentityGuard } from "./authenticated-identity.guard"
import { CurrentUser, type DevUser } from "./current-user.decorator"
import { UserCloudAiService } from "./user-cloud-ai.service"
import type { UserCloudAiSettingsView } from "./user-ai.types"

@Controller("users")
@UseGuards(AuthenticatedIdentityGuard)
export class UsersController {
  constructor(
    @Inject(UserCloudAiService) private readonly cloudAi: UserCloudAiService
  ) {}

  @Get("me/cloud-ai-settings")
  getCloudAiSettings(
    @CurrentUser() user: DevUser
  ): Promise<UserCloudAiSettingsView> {
    return this.cloudAi.getSettings(user.id)
  }

  @Patch("me/cloud-ai-settings")
  updateCloudAiSettings(
    @CurrentUser() user: DevUser,
    @Body()
    body: {
      openAiApiKey?: string
      openAiBaseUrl?: string
      openAiModel?: string
    }
  ): Promise<UserCloudAiSettingsView> {
    return this.cloudAi.updateSettings(user.id, body)
  }
}

import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import { CurrentUser, type DevUser } from "../auth/current-user.decorator"
import { AiService } from "./ai.service"
import type { AiChatRequest } from "./ai.types"

@Controller("ai")
@UseGuards(AuthenticatedIdentityGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("chat")
  async chat(
    @Body() body: AiChatRequest,
    @CurrentUser() user: DevUser,
    @Req() request: any,
    @Res() response: any
  ): Promise<void> {
    response.status(200)
    response.setHeader("Content-Type", "text/event-stream")
    response.setHeader("Cache-Control", "no-cache")
    response.setHeader("Connection", "keep-alive")
    const controller = new AbortController()
    request.on("close", () => controller.abort())
    try {
      for await (const event of this.ai.chat(body, user.id, controller.signal)) {
        if (controller.signal.aborted || response.writableEnded) break
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      }
    } finally {
      if (!response.writableEnded) response.end()
    }
  }
}

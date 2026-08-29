import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import { CurrentUser, type DevUser } from "../auth/current-user.decorator"
import { AiService } from "./ai.service"
import type { AiChatRequest, AiWriteRequest } from "./ai.types"

@Controller("ai")
@UseGuards(AuthenticatedIdentityGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Post("chat")
  async chat(
    @Body() body: AiChatRequest,
    @CurrentUser() user: DevUser,
    @Req() request: any,
    @Res() response: any
  ): Promise<void> {
    await this.streamSse(response, request, (signal) =>
      this.ai.chat(body, user.id, signal)
    )
  }

  @Post("write")
  async write(
    @Body() body: AiWriteRequest,
    @CurrentUser() user: DevUser,
    @Req() request: any,
    @Res() response: any
  ): Promise<void> {
    await this.streamSse(response, request, (signal) =>
      this.ai.write(body, user.id, signal)
    )
  }

  /** 与 chat 共用 SSE 响应头与客户端断开时的 abort 逻辑 */
  private async streamSse(
    response: any,
    request: any,
    stream: (signal: AbortSignal) => AsyncIterable<{ type: string }>
  ): Promise<void> {
    response.status(200)
    response.setHeader("Content-Type", "text/event-stream")
    response.setHeader("Cache-Control", "no-cache")
    response.setHeader("Connection", "keep-alive")
    const controller = new AbortController()
    request.on("close", () => controller.abort())
    try {
      for await (const event of stream(controller.signal)) {
        if (controller.signal.aborted || response.writableEnded) break
        response.write(
          `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
        )
      }
    } finally {
      if (!response.writableEnded) response.end()
    }
  }
}

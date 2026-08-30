import {
  Body,
  Controller,
  HttpException,
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
    response.setHeader("Cache-Control", "no-cache, no-transform")
    response.setHeader("Connection", "keep-alive")
    response.setHeader("X-Accel-Buffering", "no")
    if (typeof response.flushHeaders === "function") {
      response.flushHeaders()
    }
    const controller = new AbortController()
    request.on("close", () => controller.abort())
    try {
      for await (const event of stream(controller.signal)) {
        if (controller.signal.aborted || response.writableEnded) break
        response.write(
          `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
        )
        if (typeof response.flush === "function") {
          response.flush()
        }
      }
    } catch (error) {
      // 头已发出时 Nest 异常过滤器无法改写状态码，改为 SSE error 事件
      if (!response.writableEnded) {
        const message = formatSseErrorMessage(error)
        response.write(
          `event: error\ndata: ${JSON.stringify({ type: "error", message })}\n\n`
        )
      }
    } finally {
      if (!response.writableEnded) response.end()
    }
  }
}

function formatSseErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const payload = error.getResponse()
    if (typeof payload === "string") return payload
    if (payload && typeof payload === "object" && "message" in payload) {
      const message = (payload as { message?: string | string[] }).message
      if (Array.isArray(message)) return message.join("，")
      if (typeof message === "string") return message
    }
  }
  if (error instanceof Error && error.message) return error.message
  return "AI 服务暂不可用"
}

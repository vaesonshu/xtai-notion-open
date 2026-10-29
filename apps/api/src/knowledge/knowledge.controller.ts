import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import path from "node:path"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import { CurrentUser, type DevUser } from "../auth/current-user.decorator"
import { PrismaService } from "../database/prisma.module"
import { CosService } from "../storage/cos.service"
import { KnowledgeLibraryService } from "./knowledge-library.service"
import type { KnowledgeChatMessage } from "./knowledge-qa.service"
import { KnowledgeQaService } from "./knowledge-qa.service"
import { KnowledgeSourceService } from "./knowledge-source.service"
import {
  MAX_KNOWLEDGE_FILE_BYTES,
  type EmbeddingSettings,
  type LibraryRole,
} from "./knowledge.types"

@Controller("libraries")
@UseGuards(AuthenticatedIdentityGuard)
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeLibraryService)
    private readonly libraries: KnowledgeLibraryService,
    @Inject(KnowledgeSourceService)
    private readonly sources: KnowledgeSourceService,
    @Inject(KnowledgeQaService)
    private readonly qa: KnowledgeQaService,
    @Inject(CosService)
    private readonly cos: CosService,
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService
  ) {}

  @Get()
  listLibraries(@CurrentUser() user: DevUser) {
    return this.libraries.list(user.id)
  }

  @Post()
  createLibrary(@CurrentUser() user: DevUser, @Body() body: { name?: string }) {
    return this.libraries.create(user.id, (body.name ?? "").trim())
  }

  @Get(":id")
  async getLibrary(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser
  ) {
    const libraries = await this.libraries.list(user.id)
    const found = libraries.find((item) => item.id === libraryId)
    if (found) {
      return found
    }
    await this.libraries.requireRole(user.id, libraryId, "viewer")
    throw new NotFoundException("资料库不存在")
  }

  @Patch(":id")
  renameLibrary(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { name?: string }
  ) {
    return this.libraries.rename(user.id, libraryId, (body.name ?? "").trim())
  }

  @Delete(":id")
  async deleteLibrary(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser
  ): Promise<void> {
    const keys = await this.libraries.fileStorageKeys(user.id, libraryId)
    // 先清 COS 再删库行：对象删失败时记录还在，避免库已空而文件仍占桶。
    for (const key of keys) {
      await this.cos.deleteObject(key)
    }
    await this.libraries.deleteLibrary(user.id, libraryId)
  }

  @Put(":id/embedding")
  updateEmbedding(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser,
    @Body() body: EmbeddingSettings
  ) {
    return this.libraries.updateEmbedding(user.id, libraryId, body)
  }

  @Get(":id/members")
  async listMembers(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser
  ) {
    await this.libraries.requireRole(user.id, libraryId, "viewer")
    // Task 6 没有 listMembers；成员行只能从现有 Prisma 关系读出。
    if (!this.prisma) {
      return []
    }
    const members = await this.prisma.client.knowledgeLibraryMember.findMany({
      where: { libraryId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            color: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      displayName: member.user.displayName,
      color: member.user.color,
      role: member.role as LibraryRole,
    }))
  }

  @Post(":id/members")
  inviteMember(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser,
    @Body()
    body: {
      userId?: string
      email?: string
      role: Exclude<LibraryRole, "owner">
    }
  ) {
    return this.libraries.inviteMember(user.id, libraryId, body)
  }

  @Patch(":id/members/:userId")
  updateMemberRole(
    @Param("id") libraryId: string,
    @Param("userId") memberUserId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { role: Exclude<LibraryRole, "owner"> }
  ) {
    return this.libraries.updateMemberRole(
      user.id,
      libraryId,
      memberUserId,
      body.role
    )
  }

  @Delete(":id/members/:userId")
  removeMember(
    @Param("id") libraryId: string,
    @Param("userId") memberUserId: string,
    @CurrentUser() user: DevUser
  ) {
    return this.libraries.removeMember(user.id, libraryId, memberUserId)
  }

  @Get(":id/sources")
  listSources(@Param("id") libraryId: string, @CurrentUser() user: DevUser) {
    return this.sources.list(user.id, libraryId)
  }

  @Post(":id/sources/file")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_KNOWLEDGE_FILE_BYTES } })
  )
  uploadFile(
    @Param("id") libraryId: string,
    @UploadedFile()
    file: { originalname: string; buffer: Buffer } | undefined,
    @CurrentUser() user: DevUser
  ) {
    if (!file) {
      throw new BadRequestException("文件不能为空")
    }
    return this.sources.uploadFile(user.id, libraryId, {
      filename: path.basename(file.originalname),
      bytes: file.buffer,
    })
  }

  @Post(":id/sources/document")
  importDocument(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { documentId: string }
  ) {
    return this.sources.importDocument(user.id, libraryId, body.documentId)
  }

  @Post(":id/sources/:sourceId/reindex")
  reindexSource(
    @Param("id") libraryId: string,
    @Param("sourceId") sourceId: string,
    @CurrentUser() user: DevUser
  ) {
    return this.sources.reindex(user.id, libraryId, sourceId)
  }

  @Get(":id/sources/:sourceId/file")
  async downloadFile(
    @Param("id") libraryId: string,
    @Param("sourceId") sourceId: string,
    @CurrentUser() user: DevUser
  ): Promise<StreamableFile> {
    const { storageKey } = await this.sources.fileOf(
      user.id,
      libraryId,
      sourceId
    )
    const body = await this.cos.getObject(storageKey)
    const filename = path.posix.basename(storageKey)
    return new StreamableFile(body, {
      type: "application/octet-stream",
      disposition: `attachment; filename="${filename}"`,
    })
  }

  @Delete(":id/sources/:sourceId")
  async deleteSource(
    @Param("id") libraryId: string,
    @Param("sourceId") sourceId: string,
    @CurrentUser() user: DevUser
  ): Promise<void> {
    let storageKey: string | undefined
    try {
      storageKey = (await this.sources.fileOf(user.id, libraryId, sourceId))
        .storageKey
    } catch (error) {
      // 快照没有对象，fileOf 会 404「原文件不存在」；不要编造 storageKey。
      if (
        !(error instanceof NotFoundException) ||
        error.message !== "原文件不存在"
      ) {
        throw error
      }
    }
    if (storageKey) {
      await this.cos.deleteObject(storageKey)
    }
    await this.sources.deleteSource(user.id, libraryId, sourceId)
  }

  @Post(":id/retrieve")
  retrieve(
    @Param("id") libraryId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { query?: string }
  ) {
    return this.qa.retrieve(user.id, libraryId, body.query ?? "")
  }

  @Post(":id/qa")
  async answerQuestion(
    @Param("id") libraryId: string,
    @Body() body: { messages?: KnowledgeChatMessage[] },
    @CurrentUser() user: DevUser,
    @Req() request: { on: (event: string, listener: () => void) => void },
    @Res() response: SseResponse
  ): Promise<void> {
    await this.streamSse(
      response,
      request,
      this.qa.answer(user.id, libraryId, body.messages ?? [])
    )
  }

  private async streamSse(
    response: SseResponse,
    request: { on: (event: string, listener: () => void) => void },
    stream: AsyncIterable<{ type: string }>
  ): Promise<void> {
    const abort = new AbortController()
    request.on("close", () => abort.abort())
    const iterator = stream[Symbol.asyncIterator]()
    // 配置校验发生在第一次 next；失败时还没写出 SSE，走普通 HTTP 错误。
    const first = await iterator.next()
    response.status(200)
    response.setHeader("Content-Type", "text/event-stream")
    response.setHeader("Cache-Control", "no-cache, no-transform")
    response.setHeader("Connection", "keep-alive")
    response.setHeader("X-Accel-Buffering", "no")
    if (typeof response.flushHeaders === "function") {
      response.flushHeaders()
    }
    const writeEvent = (event: { type: string }) => {
      response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      if (typeof response.flush === "function") {
        response.flush()
      }
    }
    try {
      if (!first.done && !abort.signal.aborted) {
        writeEvent(first.value)
      }
      while (!abort.signal.aborted && !response.writableEnded) {
        const next = await iterator.next()
        if (next.done) {
          break
        }
        writeEvent(next.value)
      }
    } catch (error) {
      if (!response.writableEnded) {
        const message = formatSseErrorMessage(error)
        response.write(
          `event: error\ndata: ${JSON.stringify({
            type: "error",
            message,
          })}\n\n`
        )
      }
    } finally {
      if (!response.writableEnded) {
        response.end()
      }
    }
  }
}

type SseResponse = {
  status: (code: number) => void
  setHeader: (name: string, value: string) => void
  writableEnded: boolean
  write: (value: string) => void
  end: () => void
  flushHeaders?: () => void
  flush?: () => void
}

function formatSseErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const payload = error.getResponse()
    if (typeof payload === "string") {
      return payload
    }
    if (payload && typeof payload === "object" && "message" in payload) {
      const message = (payload as { message?: string | string[] }).message
      if (Array.isArray(message)) {
        return message.join("，")
      }
      if (typeof message === "string") {
        return message
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "AI 服务暂不可用"
}

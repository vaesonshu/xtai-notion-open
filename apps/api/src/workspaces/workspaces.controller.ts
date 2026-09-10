import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import type { DevUser } from "../auth/dev-user"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import type { DocumentMetadata } from "../documents/document-types"
import { DocumentsService } from "../documents/documents.service"
import { WorkspacesService } from "./workspaces.service"
import type { WorkspaceAiSettings } from "./workspace-ai.types"
import type {
  WorkspaceInviteCandidate,
  WorkspaceMemberView,
  WorkspaceSummary,
} from "./workspace.types"
import { isWorkspaceRole, type WorkspaceRole } from "./workspace.types"

@Controller("workspaces")
@UseGuards(AuthenticatedIdentityGuard)
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  @Get()
  listWorkspaces(@CurrentUser() user: DevUser): Promise<WorkspaceSummary[]> {
    return this.workspaces.listWorkspaces(user.id)
  }

  @Post()
  createWorkspace(
    @CurrentUser() user: DevUser,
    @Body() body: { name: string }
  ): Promise<WorkspaceSummary> {
    return this.workspaces.createWorkspace(user.id, body.name ?? "")
  }

  @Get(":workspaceId")
  getWorkspace(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser
  ): Promise<WorkspaceSummary> {
    return this.workspaces.getWorkspace(workspaceId, user.id)
  }

  @Get(":workspaceId/ai-settings")
  getAiSettings(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser
  ): Promise<WorkspaceAiSettings> {
    return this.workspaces.getAiSettings(workspaceId, user.id)
  }

  @Patch(":workspaceId/ai-settings")
  updateAiSettings(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser,
    @Body()
    body: {
      aiProvider?: WorkspaceAiSettings["aiProvider"]
      localCodexPrompt?: string
    }
  ): Promise<WorkspaceAiSettings> {
    return this.workspaces.updateAiSettings(workspaceId, user.id, body)
  }

  @Patch(":workspaceId")
  renameWorkspace(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { name: string }
  ): Promise<WorkspaceSummary> {
    return this.workspaces.renameWorkspace(
      workspaceId,
      user.id,
      body.name ?? ""
    )
  }

  @Get(":workspaceId/members")
  listMembers(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser
  ): Promise<WorkspaceMemberView[]> {
    return this.workspaces.listMembers(workspaceId, user.id)
  }

  @Get(":workspaceId/members/search")
  searchInviteCandidates(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser,
    @Query("q") query = ""
  ): Promise<WorkspaceInviteCandidate[]> {
    return this.workspaces.searchInviteCandidates(
      workspaceId,
      user.id,
      query
    )
  }

  @Post(":workspaceId/members")
  addMember(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser,
    @Body()
    body: { userId?: string; email?: string; role: WorkspaceRole }
  ): Promise<void> {
    if (!isWorkspaceRole(body.role)) {
      throw new BadRequestException("无效的成员角色")
    }
    if (body.email?.trim()) {
      return this.workspaces.inviteMemberByEmail(
        workspaceId,
        user.id,
        body.email,
        body.role
      )
    }
    if (!body.userId) {
      throw new BadRequestException("请提供 userId 或 email")
    }
    return this.workspaces.addMember(
      workspaceId,
      user.id,
      body.userId,
      body.role
    )
  }

  @Patch(":workspaceId/members/:memberUserId")
  updateMemberRole(
    @Param("workspaceId") workspaceId: string,
    @Param("memberUserId") memberUserId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { role: WorkspaceRole }
  ): Promise<void> {
    if (!isWorkspaceRole(body.role)) {
      throw new BadRequestException("无效的成员角色")
    }
    return this.workspaces.updateMemberRole(
      workspaceId,
      user.id,
      memberUserId,
      body.role
    )
  }

  @Delete(":workspaceId/members/:memberUserId")
  removeMember(
    @Param("workspaceId") workspaceId: string,
    @Param("memberUserId") memberUserId: string,
    @CurrentUser() user: DevUser
  ): Promise<void> {
    return this.workspaces.removeMember(workspaceId, user.id, memberUserId)
  }

  @Get(":workspaceId/documents")
  listDocuments(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser
  ): Promise<DocumentMetadata[]> {
    return this.documents.listDocumentsInWorkspace(user.id, workspaceId)
  }

  @Post(":workspaceId/documents/import-markdown")
  importMarkdown(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { title?: string; markdown?: string }
  ): Promise<DocumentMetadata> {
    return this.documents.importMarkdownInWorkspace(
      user.id,
      workspaceId,
      body.title ?? "",
      body.markdown ?? ""
    )
  }

  @Post(":workspaceId/documents")
  createDocument(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: DevUser,
    @Body() body: { parentId?: string } = {}
  ): Promise<DocumentMetadata> {
    if (body.parentId) {
      return this.documents.createChildDocumentInWorkspace(
        body.parentId,
        user.id,
        workspaceId
      )
    }
    return this.documents.createDocumentInWorkspace(user.id, workspaceId)
  }
}

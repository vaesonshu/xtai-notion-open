import { Controller, Get, Inject, Param } from "@nestjs/common"
import { DocumentsService } from "../documents/documents.service"
import type {
  PublicWorkspaceDocumentSummary,
  PublicWorkspaceView,
} from "./workspace.types"
import { WorkspacesService } from "./workspaces.service"

/** 无需登录：仅 public 知识库及其已发布文档。 */
@Controller("public/workspaces")
export class PublicWorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
    @Inject(DocumentsService) private readonly documents: DocumentsService
  ) {}

  @Get(":workspaceId")
  getWorkspace(
    @Param("workspaceId") workspaceId: string
  ): Promise<PublicWorkspaceView> {
    return this.workspaces.getPublicWorkspace(workspaceId)
  }

  @Get(":workspaceId/documents")
  listPublishedDocuments(
    @Param("workspaceId") workspaceId: string
  ): Promise<PublicWorkspaceDocumentSummary[]> {
    return this.documents.listPublicWorkspaceDocuments(workspaceId)
  }
}

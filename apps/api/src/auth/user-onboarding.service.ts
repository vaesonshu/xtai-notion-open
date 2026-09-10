import { Inject, Injectable } from "@nestjs/common"
import { DocumentsRepository } from "../documents/documents.repository"
import { WorkspaceRepository } from "../workspaces/workspace.repository"

const DEFAULT_WORKSPACE_NAME = "我的知识库"

/**
 * Ensures brand-new accounts have a personal workspace and starter document
 * before the client loads /documents or the workspace shell.
 */
@Injectable()
export class UserOnboardingService {
  constructor(
    @Inject(WorkspaceRepository)
    private readonly workspaces: WorkspaceRepository,
    @Inject(DocumentsRepository)
    private readonly documents: DocumentsRepository
  ) {}

  async ensureDefaultWorkspaceAndDocument(userId: string): Promise<void> {
    const workspace =
      (await this.workspaces.findDefaultForUser(userId)) ??
      (await this.workspaces.create(DEFAULT_WORKSPACE_NAME, userId))

    const existingDocuments = await this.documents.listForUser(userId)
    if (existingDocuments.length > 0) {
      return
    }

    await this.documents.createInWorkspace(workspace.id, userId)
  }
}

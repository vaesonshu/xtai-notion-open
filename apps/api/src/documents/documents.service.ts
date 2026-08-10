import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type { DocumentMetadata, DocumentRole } from "./document-types"
import { DocumentsRepository } from "./documents.repository"

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentsRepository)
    private readonly documents: DocumentsRepository
  ) {}

  getMemberRole(
    documentId: string,
    userId: string
  ): Promise<DocumentRole | null> {
    return this.documents.getMemberRole(documentId, userId)
  }

  async assertCanRead(
    documentId: string,
    userId: string
  ): Promise<DocumentRole> {
    const role = await this.getMemberRole(documentId, userId)
    if (!role) {
      throw new ForbiddenException("Not a document member")
    }
    return role
  }

  async assertCanWrite(
    documentId: string,
    userId: string
  ): Promise<DocumentRole> {
    const role = await this.assertCanRead(documentId, userId)
    if (role === "viewer") {
      throw new ForbiddenException("Viewer cannot write to document")
    }
    return role
  }

  async getDocument(
    documentId: string,
    userId: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanRead(documentId, userId)
    const row = await this.documents.findById(documentId)
    if (!row) {
      throw new NotFoundException("Document not found")
    }
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async createDocument(userId: string): Promise<DocumentMetadata> {
    const row = await this.documents.createForOwner(userId)
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      role: "owner",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
